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
from app.features.ai_keys.services.ai_key_service import AIKeyService


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
async def test_ai_key_service_openrouter_validation_rate_limit() -> None:
    """Valida o teste de chave do OpenRouter no AIKeyService lidando com HTTP 429."""
    respx.get("https://openrouter.ai/api/v1/auth/key").mock(
        return_value=Response(429, json={"error": "Rate limit"})
    )

    with pytest.raises(LLMProviderError, match="excedido"):
        await AIKeyService.test_openrouter_key("sk-or-v1-testkey")
