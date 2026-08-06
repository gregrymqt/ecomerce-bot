import os
from typing import List, Optional
import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.core.config.settings import settings
from app.core.shared.logger import get_logger
from app.features.ai_enrichment.domain.exceptions import LLMProviderError
from app.features.ai_enrichment.domain.interfaces import LLMProvider
from app.features.ai_enrichment.schemas import EnrichedProductResponse

logger = get_logger("OpenRouterLLMProvider")

DEFAULT_FALLBACK_MODELS = [
    "groq/llama-3.3-70b",
    "deepseek/deepseek-chat",
    "openai/gpt-4o-mini",
]


def _is_transient_openrouter_error(exc: BaseException) -> bool:
    if isinstance(exc, (httpx.RequestError, httpx.NetworkError, httpx.TimeoutException)):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in {429, 500, 502, 503, 504}
    return False


class OpenRouterLLMProvider(LLMProvider):
    """Provedor de LLM assíncrono para OpenRouter com suporte a fallback de modelos, retries resilientes e headers customizados."""

    OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

    def __init__(
        self,
        api_key: Optional[str] = None,
        preferred_models: Optional[List[str]] = None,
    ):
        key = api_key or getattr(settings, "OPENROUTER_API_KEY", None) or os.environ.get("OPENROUTER_API_KEY")
        if not key:
            raise ValueError("OPENROUTER_API_KEY is not configured.")
        self.api_key = key
        self.models = preferred_models if preferred_models else DEFAULT_FALLBACK_MODELS

    @property
    def name(self) -> str:
        return "OpenRouter"

    def _get_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
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
    async def _post_request(self, payload: dict) -> httpx.Response:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                self.OPENROUTER_URL,
                headers=self._get_headers(),
                json=payload,
            )
            if response.status_code in {429, 500, 502, 503, 504}:
                logger.warning(
                    f"Status transitório {response.status_code} na API do OpenRouter. Tentando novamente via Tenacity..."
                )
                response.raise_for_status()
            return response

    async def enrich(self, prompt: str) -> EnrichedProductResponse:
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
