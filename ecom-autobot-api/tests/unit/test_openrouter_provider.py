import json
from typing import Any, Dict
from unittest.mock import AsyncMock, patch

import httpx
import pytest
import respx
from httpx import Response
from tenacity import wait_none

from app.features.ai_enrichment.domain.exceptions import LLMProviderError
from app.features.ai_enrichment.infrastructure.providers.openrouter_provider import (
    OpenRouterLLMProvider,
)



@pytest.fixture
def mock_openrouter_success_payload() -> Dict[str, Any]:
    """Payload de resposta bem-sucedida da API OpenRouter."""
    enriched_json = {
        "title": "Produto Teste Enriquecido",
        "description": "Descrição magnética e otimizada para SEO",
        "tags": ["ecommerce", "bot"],
    }
    return {
        "choices": [
            {
                "message": {
                    "content": json.dumps(enriched_json)
                }
            }
        ]
    }


@respx.mock
@pytest.mark.asyncio
async def test_openrouter_rate_limit_retry_recovers_on_third_attempt(
    mock_openrouter_success_payload: Dict[str, Any]
) -> None:
    """Caso 1 (Rate Limit Retry): Simular HTTP 429 nas 2 primeiras tentativas e HTTP 200 na 3ª tentativa. Assertar que o tenacity recupera o resultado."""
    route = respx.post("https://openrouter.ai/api/v1/chat/completions")
    route.side_effect = [
        Response(429, json={"error": {"message": "Rate limit exceeded"}}),
        Response(429, json={"error": {"message": "Rate limit exceeded"}}),
        Response(200, json=mock_openrouter_success_payload),
    ]
    provider = OpenRouterLLMProvider(api_key="sk-or-v1-testkey123")
    provider._post_request.retry.wait = wait_none()  # type: ignore[attr-defined]

    with patch("asyncio.sleep", new_callable=AsyncMock):
        result = await provider.enrich("Prompt de teste de rate limit")

    assert result.title == "Produto Teste Enriquecido"
    assert route.call_count == 3


@respx.mock
@pytest.mark.asyncio
async def test_openrouter_fallback_service_unavailable_raises_llm_provider_error() -> None:
    """Caso 2 (Fallback / Timeout): Simular HTTP 503 em todas as tentativas e verificar lançamento de LLMProviderError."""
    route = respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=Response(503, json={"error": {"message": "Service Unavailable"}})
    )
    provider = OpenRouterLLMProvider(api_key="sk-or-v1-testkey123")
    provider._post_request.retry.wait = wait_none()  # type: ignore[attr-defined]

    with patch("asyncio.sleep", new_callable=AsyncMock):
        with pytest.raises(LLMProviderError) as exc_info:
            await provider.enrich("Prompt de teste com falha de serviço")

    assert "communication" in str(exc_info.value).lower() or "comunicação" in str(exc_info.value).lower() or "status" in str(exc_info.value).lower()
    assert route.call_count == 3


@respx.mock
@pytest.mark.asyncio
async def test_openrouter_retry_on_429_rate_limit() -> None:
    """Simula retorno HTTP 429 (Rate Limit) no OpenRouter e valida os 3 retries antes de falhar."""
    route = respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=Response(429, json={"error": {"message": "Rate limit exceeded"}})
    )
    provider = OpenRouterLLMProvider(api_key="sk-or-v1-testkey123")
    provider._post_request.retry.wait = wait_none()  # type: ignore[attr-defined]

    with patch("asyncio.sleep", new_callable=AsyncMock):
        with pytest.raises(httpx.HTTPStatusError) as exc_info:
            await provider._post_request({"models": ["groq/llama-3.3-70b"]})

    assert exc_info.value.response.status_code == 429
    assert route.call_count == 3


@respx.mock
@pytest.mark.asyncio
async def test_openrouter_retry_on_503_service_unavailable() -> None:
    """Simula retorno HTTP 503 (Service Unavailable) e valida os 3 retries via Tenacity."""
    route = respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=Response(503, json={"error": {"message": "Service Unavailable"}})
    )
    provider = OpenRouterLLMProvider(api_key="sk-or-v1-testkey123")
    provider._post_request.retry.wait = wait_none()  # type: ignore[attr-defined]

    with patch("asyncio.sleep", new_callable=AsyncMock):
        with pytest.raises(httpx.HTTPStatusError) as exc_info:
            await provider._post_request({"models": ["groq/llama-3.3-70b"]})

    assert exc_info.value.response.status_code == 503
    assert route.call_count == 3


@respx.mock
@pytest.mark.asyncio
async def test_openrouter_retry_recovers_on_second_attempt(
    mock_openrouter_success_payload: Dict[str, Any]
) -> None:
    """Valida que o mecanismo de retry se recupera na 2ª tentativa após um erro transitório 503."""
    route = respx.post("https://openrouter.ai/api/v1/chat/completions")
    route.side_effect = [
        Response(503, json={"error": "Service Unavailable"}),
        Response(200, json=mock_openrouter_success_payload),
    ]
    provider = OpenRouterLLMProvider(api_key="sk-or-v1-testkey123")
    provider._post_request.retry.wait = wait_none()  # type: ignore[attr-defined]

    with patch("asyncio.sleep", new_callable=AsyncMock):
        result = await provider.enrich("Prompt de teste")

    assert result.title == "Produto Teste Enriquecido"
    assert route.call_count == 2


@respx.mock
@pytest.mark.asyncio
async def test_openrouter_non_transient_401_error_no_retry() -> None:
    """Garante que erros não transitórios (ex: 401 Unauthorized) não acionem retries."""
    route = respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=Response(401, json={"error": {"message": "Invalid API Key"}})
    )
    provider = OpenRouterLLMProvider(api_key="sk-or-v1-invalidkey")
    provider._post_request.retry.wait = wait_none()  # type: ignore[attr-defined]

    with pytest.raises(LLMProviderError, match="inválida ou não autorizada"):
        await provider.enrich("Prompt de teste")

    # Apenas 1 tentativa, sem retries para erros 401
    assert route.call_count == 1





@respx.mock
@pytest.mark.asyncio
async def test_openrouter_generate_completion_success() -> None:
    """Valida a execução de generate_completion com retorno estruturado em LLMCompletionResponse."""
    from app.features.ai_enrichment.schemas import LLMCompletionRequest, LLMCompletionResponse
    from app.core.config.settings import settings

    route = respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=Response(
            200,
            json={
                "model": "deepseek/deepseek-chat",
                "choices": [{"message": {"content": "Resposta de teste gerada pela LLM"}}],
                "usage": {
                    "prompt_tokens": 15,
                    "completion_tokens": 8,
                    "total_tokens": 23,
                },
            },
        )
    )

    provider = OpenRouterLLMProvider(api_key="sk-or-v1-testkey123")
    req = LLMCompletionRequest(
        prompt="Escreva uma frase de efeito",
        system_prompt="Você é um assistente de vendas",
        temperature=0.7,
        max_tokens=500,
    )

    response = await provider.generate_completion(req, api_key="sk-or-v1-testkey123")

    assert isinstance(response, LLMCompletionResponse)
    assert response.content == "Resposta de teste gerada pela LLM"
    assert response.model_used == "deepseek/deepseek-chat"
    assert response.prompt_tokens == 15
    assert response.completion_tokens == 8
    assert response.total_tokens == 23
    assert response.provider_response_time_ms >= 0.0
    assert route.call_count == 1


@respx.mock
@pytest.mark.asyncio
async def test_openrouter_generate_completion_rate_limit_error() -> None:
    """Valida que HTTP 429 dispara OpenRouterRateLimitError."""
    from app.features.ai_enrichment.schemas import LLMCompletionRequest
    from app.features.ai_enrichment.domain.exceptions import OpenRouterRateLimitError

    respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=Response(429, json={"error": {"message": "Rate limit exceeded"}})
    )

    provider = OpenRouterLLMProvider(api_key="sk-or-v1-testkey123")
    provider._post_request.retry.wait = wait_none()  # type: ignore[attr-defined]

    req = LLMCompletionRequest(prompt="Teste rate limit")
    with patch("asyncio.sleep", new_callable=AsyncMock):
        with pytest.raises(OpenRouterRateLimitError) as exc_info:
            await provider.generate_completion(req, api_key="sk-or-v1-testkey123")

    assert exc_info.value.status_code == 429


@respx.mock
@pytest.mark.asyncio
async def test_openrouter_generate_completion_api_error() -> None:
    """Valida que status HTTP 400 dispara OpenRouterAPIError sem retries."""
    from app.features.ai_enrichment.schemas import LLMCompletionRequest
    from app.features.ai_enrichment.domain.exceptions import OpenRouterAPIError

    respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=Response(400, json={"error": {"message": "Bad Request"}})
    )

    provider = OpenRouterLLMProvider(api_key="sk-or-v1-testkey123")
    req = LLMCompletionRequest(prompt="Teste bad request")

    with pytest.raises(OpenRouterAPIError) as exc_info:
        await provider.generate_completion(req, api_key="sk-or-v1-testkey123")

    assert exc_info.value.status_code == 400


def test_openrouter_settings_config() -> None:
    """Valida que as variáveis de ambiente do OpenRouter estão configuradas no Settings."""
    from app.core.config.settings import settings

    assert settings.OPENROUTER_BASE_URL == "https://openrouter.ai/api/v1"
    assert settings.DEFAULT_PRIMARY_MODEL == "deepseek/deepseek-chat"
    assert settings.DEFAULT_FALLBACK_MODEL_1 == "groq/llama-3.3-70b-versatile"
    assert settings.DEFAULT_FALLBACK_MODEL_2 == "google/gemini-2.0-flash-001"


