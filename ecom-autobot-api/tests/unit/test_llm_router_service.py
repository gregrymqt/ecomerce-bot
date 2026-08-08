from unittest.mock import AsyncMock, MagicMock, patch
import pytest
import respx
from httpx import Response

from app.core.config.settings import settings
from app.core.security.crypto import encrypt_api_key
from app.features.ai_enrichment.domain.exceptions import OpenRouterAPIError
from app.features.ai_enrichment.infrastructure.providers.openrouter_provider import (
    DEFAULT_FALLBACK_MODELS,
    OpenRouterLLMProvider,
)
from app.features.ai_enrichment.schemas import (
    LLMCompletionRequest,
    LLMCompletionResponse,
)
from app.features.ai_enrichment.services.llm_router_service import LLMEngineRouter
from app.features.products.domain.models import TenantConfigModel


@pytest.mark.asyncio
async def test_openrouter_provider_sends_models_list_and_logs() -> None:
    """Valida se OpenRouterLLMProvider envia o array 'models' no payload e registra a resposta."""
    with respx.mock:
        route = respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
            return_value=Response(
                200,
                json={
                    "model": "meta-llama/llama-3.3-70b-instruct",
                    "choices": [{"message": {"content": "Resposta via Llama 3.3"}}],
                    "usage": {
                        "prompt_tokens": 20,
                        "completion_tokens": 10,
                        "total_tokens": 30,
                    },
                },
            )
        )

        provider = OpenRouterLLMProvider(api_key="sk-or-v1-globaltest")
        req = LLMCompletionRequest(prompt="Gere uma legenda")

        response = await provider.generate_completion(req, api_key="sk-or-v1-globaltest")

        assert response.content == "Resposta via Llama 3.3"
        assert response.model_used == "meta-llama/llama-3.3-70b-instruct"
        assert response.prompt_tokens == 20
        assert response.completion_tokens == 10
        assert response.total_tokens == 30

        # Valida que o payload enviado continha a lista "models"
        sent_payload = route.calls.last.request.content.decode("utf-8")
        assert '"models":["deepseek/deepseek-chat","meta-llama/llama-3.3-70b-instruct","google/gemini-flash-1.5"]' in sent_payload.replace(" ", "")


@pytest.mark.asyncio
async def test_llm_router_byok_success() -> None:
    """Valida roteamento bem-sucedido usando a chave BYOK do tenant."""
    mock_session = AsyncMock()
    encrypted_key = encrypt_api_key("sk-or-v1-tenantkey123")
    tenant_config = TenantConfigModel(
        tenant_id="tenant_byok_test",
        encrypted_keys={"openrouter_api_key": encrypted_key},
    )

    mock_provider = AsyncMock(spec=OpenRouterLLMProvider)
    mock_provider.generate_completion.return_value = LLMCompletionResponse(
        content="Conteúdo do tenant",
        model_used="deepseek/deepseek-chat",
        prompt_tokens=10,
        completion_tokens=5,
        total_tokens=15,
        provider_response_time_ms=120.0,
    )

    router = LLMEngineRouter(provider=mock_provider)

    with patch("app.features.products.repositories.tenant_config_repository.TenantConfigRepository.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = tenant_config

        req = LLMCompletionRequest(prompt="Teste BYOK")
        res = await router.generate_completion(tenant_id="tenant_byok_test", prompt_data=req, db=mock_session)

        assert res.content == "Conteúdo do tenant"
        mock_provider.generate_completion.assert_called_once_with(
            request=req,
            api_key="sk-or-v1-tenantkey123",
        )


@pytest.mark.asyncio
async def test_llm_router_byok_401_fallback_to_global_key() -> None:
    """Valida fallback para a chave mestre global quando a chave BYOK do tenant falha com 401."""
    mock_session = AsyncMock()
    encrypted_key = encrypt_api_key("sk-or-v1-invalidtenantkey")
    tenant_config = TenantConfigModel(
        tenant_id="tenant_invalid_byok",
        encrypted_keys={"openrouter_api_key": encrypted_key},
    )

    mock_provider = AsyncMock(spec=OpenRouterLLMProvider)
    # 1ª chamada (BYOK): 401 Unauthorized
    # 2ª chamada (Global): Sucesso
    mock_provider.generate_completion.side_effect = [
        OpenRouterAPIError("Chave inválida", status_code=401),
        LLMCompletionResponse(
            content="Conteúdo via chave global",
            model_used="deepseek/deepseek-chat",
            prompt_tokens=12,
            completion_tokens=6,
            total_tokens=18,
            provider_response_time_ms=150.0,
        ),
    ]

    router = LLMEngineRouter(provider=mock_provider)

    with patch.object(settings, "OPENROUTER_API_KEY", "sk-or-v1-globalmasterkey"):
        with patch("app.features.products.repositories.tenant_config_repository.TenantConfigRepository.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = tenant_config

            req = LLMCompletionRequest(prompt="Teste fallback BYOK")
            res = await router.generate_completion(tenant_id="tenant_invalid_byok", prompt_data=req, db=mock_session)

            assert res.content == "Conteúdo via chave global"
            assert mock_provider.generate_completion.call_count == 2


@pytest.mark.asyncio
async def test_llm_router_no_byok_uses_global_key() -> None:
    """Valida uso direto da chave global quando o tenant não possui BYOK cadastrada."""
    mock_session = AsyncMock()
    mock_provider = AsyncMock(spec=OpenRouterLLMProvider)
    mock_provider.generate_completion.return_value = LLMCompletionResponse(
        content="Conteúdo via global direto",
        model_used="google/gemini-flash-1.5",
        prompt_tokens=8,
        completion_tokens=4,
        total_tokens=12,
        provider_response_time_ms=95.0,
    )

    router = LLMEngineRouter(provider=mock_provider)

    with patch.object(settings, "OPENROUTER_API_KEY", "sk-or-v1-globalmasterkey"):
        with patch("app.features.products.repositories.tenant_config_repository.TenantConfigRepository.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = None

            req = LLMCompletionRequest(prompt="Teste sem BYOK")
            res = await router.generate_completion(tenant_id="tenant_no_byok", prompt_data=req, db=mock_session)

            assert res.content == "Conteúdo via global direto"
            mock_provider.generate_completion.assert_called_once_with(
                request=req,
                api_key="sk-or-v1-globalmasterkey",
            )


@pytest.mark.asyncio
async def test_llm_router_no_keys_raises_openrouter_api_error() -> None:
    """Valida lançamento de exceção quando nem o tenant nem o sistema possuem chave configurada."""
    mock_session = AsyncMock()
    mock_provider = AsyncMock(spec=OpenRouterLLMProvider)
    router = LLMEngineRouter(provider=mock_provider)

    with patch.object(settings, "OPENROUTER_API_KEY", ""):
        with patch("app.features.products.repositories.tenant_config_repository.TenantConfigRepository.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = None

            req = LLMCompletionRequest(prompt="Sem nenhuma chave")
            with pytest.raises(OpenRouterAPIError) as exc_info:
                await router.generate_completion(tenant_id="tenant_empty", prompt_data=req, db=mock_session)

            assert exc_info.value.status_code == 401
