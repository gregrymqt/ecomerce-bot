import os
import time
import logging
from typing import List, Optional
import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.core.config.settings import settings
from app.ai.schemas import LLMCompletionRequest, LLMCompletionResponse, EnrichedProductResponse

logger = logging.getLogger(__name__)

DEFAULT_FALLBACK_MODELS = [
    "deepseek/deepseek-chat",
    "meta-llama/llama-3.3-70b-instruct",
    "google/gemini-flash-1.5",
]

def _is_transient_error(exc: BaseException) -> bool:
    if isinstance(exc, (httpx.RequestError, httpx.NetworkError, httpx.TimeoutException)):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in {429, 500, 502, 503, 504}
    return False

class OpenRouterLLMProvider:
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

    def _get_headers(self, key: Optional[str] = None) -> dict:
        token = key or self.api_key or getattr(settings, "OPENROUTER_API_KEY", "")
        return {
            "Authorization": f"Bearer {token}",
            "HTTP-Referer": "https://ecommercebot.local",
            "X-Title": "EcommerceBot",
            "Content-Type": "application/json",
        }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(_is_transient_error),
        reraise=True,
    )
    async def generate_completion(
        self,
        request: LLMCompletionRequest,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ) -> LLMCompletionResponse:
        effective_key = api_key or self.api_key
        if not effective_key:
            raise ValueError("OPENROUTER_API_KEY não foi configurada.")

        models_list = [request.model_override] if request.model_override else ([model] if model else self.models)

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
        endpoint = f"{self.base_url}/chat/completions"
        headers = self._get_headers(key=effective_key)

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(endpoint, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        choices = data.get("choices", [])
        content = choices[0].get("message", {}).get("content", "") if choices else ""

        usage = data.get("usage", {}) or {}
        prompt_tokens = usage.get("prompt_tokens", 0) or 0
        completion_tokens = usage.get("completion_tokens", 0) or 0
        total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens) or 0
        model_used = data.get("model") or models_list[0]

        return LLMCompletionResponse(
            content=content,
            model_used=model_used,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            provider_response_time_ms=round(elapsed_ms, 2),
        )
