from unittest.mock import AsyncMock, patch
import pytest

from app.features.ai_enrichment.domain.exceptions import OpenRouterAPIError
from app.features.ai_enrichment.schemas import (
    LLMCompletionRequest,
    LLMCompletionResponse,
)
from app.features.ai_enrichment.services.llm_router_service import LLMEngineRouter


@pytest.mark.asyncio
async def test_llm_router_byok_success():
    """Testa se o LLMEngineRouter utiliza a chave BYOK do tenant quando disponível."""
    mock_provider = AsyncMock()
    mock_provider.generate_completion.return_value = LLMCompletionResponse(
        content="Resposta BYOK",
        model_used="deepseek/deepseek-chat",
        prompt_tokens=10,
        completion_tokens=20,
        total_tokens=30,
        provider_response_time_ms=150.0,
    )

    router = LLMEngineRouter(provider=mock_provider)
    prompt_req = LLMCompletionRequest(prompt="Olá")

    with patch(
        "app.features.products.repositories.tenant_config_repository.TenantConfigRepository.get_openrouter_byok_key",
        new_callable=AsyncMock,
        return_value="sk-or-byok-tenant-key",
    ):
        res = await router.generate_completion(tenant_id="tenant_byok", prompt_data=prompt_req)

    assert res.content == "Resposta BYOK"
    mock_provider.generate_completion.assert_called_once_with(
        request=prompt_req,
        api_key="sk-or-byok-tenant-key",
    )


@pytest.mark.asyncio
async def test_llm_router_byok_fallback_to_global_key():
    """Testa se o LLMEngineRouter faz fallback para a chave mestre se a chave BYOK falhar com 401."""
    mock_provider = AsyncMock()

    # Primeira chamada (BYOK) lança 401, segunda chamada (global) sucede
    mock_provider.generate_completion.side_effect = [
        OpenRouterAPIError("Chave BYOK inválida", status_code=401),
        LLMCompletionResponse(
            content="Resposta Chave Global",
            model_used="deepseek/deepseek-chat",
            prompt_tokens=15,
            completion_tokens=25,
            total_tokens=40,
            provider_response_time_ms=200.0,
        ),
    ]

    router = LLMEngineRouter(provider=mock_provider)
    prompt_req = LLMCompletionRequest(prompt="Olá")

    with patch(
        "app.features.products.repositories.tenant_config_repository.TenantConfigRepository.get_openrouter_byok_key",
        new_callable=AsyncMock,
        return_value="sk-or-byok-invalid",
    ), patch("app.core.config.settings.settings.OPENROUTER_API_KEY", "sk-or-global-master-key"):
        res = await router.generate_completion(tenant_id="tenant_byok_failed", prompt_data=prompt_req)

    assert res.content == "Resposta Chave Global"
    assert mock_provider.generate_completion.call_count == 2
