import os
import time
from typing import List, Optional
import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.core.config.settings import settings
from app.core.shared.logger import get_logger
from app.features.ai_enrichment.domain.exceptions import (
    LLMProviderError,
    OpenRouterAPIError,
    OpenRouterRateLimitError,
)
from app.features.ai_enrichment.domain.interfaces import LLMProvider
from app.features.ai_enrichment.schemas import (
    EnrichedProductResponse,
    LLMCompletionRequest,
    LLMCompletionResponse,
)

logger = get_logger("OpenRouterLLMProvider")

DEFAULT_FALLBACK_MODELS = [
    "deepseek/deepseek-chat",
    "meta-llama/llama-3.3-70b-instruct",
    "google/gemini-flash-1.5",
]


def _is_transient_openrouter_error(exc: BaseException) -> bool:
    if isinstance(exc, (httpx.RequestError, httpx.NetworkError, httpx.TimeoutException)):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in {429, 500, 502, 503, 504}
    return False


class OpenRouterLLMProvider(LLMProvider):
    """Provedor de LLM assíncrono para comunicação com a API do OpenRouter via HTTP."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        preferred_models: Optional[List[str]] = None,
    ):
        key = api_key or getattr(settings, "OPENROUTER_API_KEY", "") or os.environ.get("OPENROUTER_API_KEY", "")
        self.api_key = key
        self.base_url = (base_url or getattr(settings, "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")).rstrip("/")
        self.models = preferred_models if preferred_models else DEFAULT_FALLBACK_MODELS

    @property
    def name(self) -> str:
        return "OpenRouter"

    def _get_headers(self, key: Optional[str] = None) -> dict:
        token = key or self.api_key or getattr(settings, "OPENROUTER_API_KEY", "")
        return {
            "Authorization": f"Bearer {token}",
            "HTTP-Referer": "https://ecomautobot.com",
            "X-Title": "ECom-Auto-Bot",
            "Content-Type": "application/json",
        }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(_is_transient_openrouter_error),
        reraise=True,
    )
    async def _post_request(self, payload: dict, api_key: Optional[str] = None) -> httpx.Response:
        endpoint = f"{self.base_url}/chat/completions"
        headers = self._get_headers(key=api_key)
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                endpoint,
                headers=headers,
                json=payload,
            )
            if response.status_code in {429, 500, 502, 503, 504}:
                logger.warning(
                    f"Status transitório {response.status_code} na API do OpenRouter. Tentando novamente via Tenacity..."
                )
                response.raise_for_status()
            return response

    async def generate_completion(
        self,
        request: LLMCompletionRequest,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        models: Optional[List[str]] = None,
    ) -> LLMCompletionResponse:
        """Gera uma conclusão via chamada assíncrona HTTP à API do OpenRouter usando fallback encadeado de modelos."""
        effective_key = api_key or self.api_key or getattr(settings, "OPENROUTER_API_KEY", "")
        if not effective_key:
            raise OpenRouterAPIError("OPENROUTER_API_KEY não foi configurada ou fornecida.", status_code=401)

        if models:
            models_list = models
        elif request.model_override:
            models_list = [request.model_override] + [m for m in self.models if m != request.model_override]
        elif model:
            models_list = [model] + [m for m in self.models if m != model]
        else:
            models_list = self.models

        messages = []
        if request.system_prompt:
            messages.append({"role": "system", "content": request.system_prompt})
        messages.append({"role": "user", "content": request.prompt})

        payload = {
            "models": models_list,
            "messages": messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
        }

        start_time = time.perf_counter()

        try:
            response = await self._post_request(payload, api_key=effective_key)
        except httpx.HTTPStatusError as exc:
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0
            status_code = exc.response.status_code
            resp_body = exc.response.text
            if status_code == 429:
                raise OpenRouterRateLimitError(
                    message="Limite de requisições excedido na API do OpenRouter (HTTP 429).",
                    response_body=resp_body,
                ) from exc
            if status_code == 402:
                raise OpenRouterAPIError(
                    message="Crédito insuficiente ou problema de faturamento no OpenRouter (HTTP 402).",
                    status_code=402,
                    response_body=resp_body,
                ) from exc
            raise OpenRouterAPIError(
                message=f"Erro HTTP {status_code} na API do OpenRouter.",
                status_code=status_code,
                response_body=resp_body,
            ) from exc
        except httpx.RequestError as exc:
            logger.error(f"Erro de conexão com OpenRouter: {exc}")
            raise OpenRouterAPIError(f"Erro de rede/conexão com OpenRouter: {str(exc)}", status_code=503) from exc

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        if response.status_code >= 400:
            resp_body = response.text
            if response.status_code == 429:
                raise OpenRouterRateLimitError(
                    message="Limite de requisições excedido na API do OpenRouter (HTTP 429).",
                    response_body=resp_body,
                )
            if response.status_code == 401:
                raise OpenRouterAPIError(
                    message="Credencial do OpenRouter inválida ou não autorizada (401).",
                    status_code=401,
                    response_body=resp_body,
                )
            if response.status_code == 402:
                raise OpenRouterAPIError(
                    message="Crédito insuficiente ou problema de faturamento no OpenRouter (HTTP 402).",
                    status_code=402,
                    response_body=resp_body,
                )
            raise OpenRouterAPIError(
                message=f"Erro retornado pela API do OpenRouter (HTTP {response.status_code}).",
                status_code=response.status_code,
                response_body=resp_body,
            )

        data = response.json()
        choices = data.get("choices", [])
        if not choices:
            raise OpenRouterAPIError("Resposta do OpenRouter não contém opções ('choices') de resposta.", status_code=500)

        content = choices[0].get("message", {}).get("content", "")
        if content is None:
            content = ""

        usage = data.get("usage", {}) or {}
        prompt_tokens = usage.get("prompt_tokens", 0) or 0
        completion_tokens = usage.get("completion_tokens", 0) or 0
        total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens) or 0

        model_used = data.get("model") or models_list[0]
        elapsed_ms_round = round(elapsed_ms, 2)

        logger.info(
            f"[OpenRouterLLMProvider] Conclusão gerada com sucesso | Modelo: {model_used} | "
            f"Tempo: {elapsed_ms_round}ms | Tokens: prompt={prompt_tokens}, completion={completion_tokens}, total={total_tokens}"
        )

        return LLMCompletionResponse(
            content=content,
            model_used=model_used,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            provider_response_time_ms=elapsed_ms_round,
        )

    async def enrich(self, prompt: str) -> EnrichedProductResponse:
        """Enriquece as informações de produto utilizando a API do OpenRouter (modo compatibilidade)."""
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY is not configured.")

        payload = {
            "models": self.models,
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
        }

        try:
            response = await self._post_request(payload)
        except (httpx.RequestError, httpx.HTTPStatusError) as e:
            logger.error(f"Erro ao acessar a API do OpenRouter: {type(e).__name__}")
            raise LLMProviderError(f"Erro de comunicação com o gateway OpenRouter: {type(e).__name__}") from e

        if response.status_code == 401:
            logger.error("Falha de autenticação (401) no OpenRouter: Credenciais inválidas ou token expirado.")
            raise LLMProviderError("Credencial do OpenRouter inválida ou não autorizada (401).")

        if response.status_code == 429:
            logger.error("Rate limit (429) excedido na API do OpenRouter.")
            raise LLMProviderError("Limite de requisições (429) excedido no gateway OpenRouter.")

        if response.status_code >= 500:
            logger.error(f"Erro interno de servidor ({response.status_code}) na API do OpenRouter.")
            raise LLMProviderError(f"Falha interna do gateway OpenRouter (HTTP {response.status_code}).")

        if response.status_code != 200:
            logger.error(f"Erro inesperado (HTTP {response.status_code}) na API do OpenRouter.")
            raise LLMProviderError(f"Erro inesperado do OpenRouter (HTTP {response.status_code}).")

        try:
            data = response.json()
            choices = data.get("choices", [])
            if not choices:
                raise LLMProviderError("Resposta do OpenRouter não contém opções ('choices') de resposta.")

            content = choices[0].get("message", {}).get("content", "")
            if not content:
                raise LLMProviderError("Conteúdo da mensagem gerada pelo OpenRouter está vazio.")

            return EnrichedProductResponse.model_validate_json(content)
        except LLMProviderError:
            raise
        except Exception as e:
            logger.error(f"Erro ao processar/validar resposta JSON da OpenRouter API: {e}", exc_info=True)
            raise LLMProviderError(f"Falha na validação do schema de resposta do OpenRouter: {str(e)}") from e

