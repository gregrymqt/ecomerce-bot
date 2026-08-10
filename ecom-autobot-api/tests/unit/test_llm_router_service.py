from unittest.mock import AsyncMock, patch
import pytest
import respx
from httpx import Response

from app.core.config.settings import settings
from app.features.ai_enrichment.domain.exceptions import OpenRouterAPIError
from app.features.ai_enrichment.infrastructure.providers.openrouter_provider import (
    OpenRouterLLMProvider,
)
from app.features.ai_enrichment.schemas import (
    LLMCompletionRequest,
    LLMCompletionResponse,
)
from app.features.ai_enrichment.services.llm_router_service import LLMEngineRouter


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
async def test_llm_router_uses_global_master_key() -> None:
    """Valida se o LLMEngineRouter utiliza diretamente a chave mestre global do sistema."""
    mock_session = AsyncMock()
    mock_provider = AsyncMock(spec=OpenRouterLLMProvider)
    mock_provider.generate_completion.return_value = LLMCompletionResponse(
        content="Conteúdo via chave global mestre",
        model_used="deepseek/deepseek-chat",
        prompt_tokens=10,
        completion_tokens=5,
        total_tokens=15,
        provider_response_time_ms=120.0,
    )

    router = LLMEngineRouter(provider=mock_provider)

    with patch.object(settings, "OPENROUTER_API_KEY", "sk-or-v1-globalmasterkey"):
        req = LLMCompletionRequest(prompt="Teste com chave unificada")
        res = await router.generate_completion(tenant_id="tenant_qa", prompt_data=req, db=mock_session)

        assert res.content == "Conteúdo via chave global mestre"
        mock_provider.generate_completion.assert_called_once_with(
            request=req,
            api_key="sk-or-v1-globalmasterkey",
        )


@pytest.mark.asyncio
async def test_llm_router_no_keys_raises_openrouter_api_error() -> None:
    """Valida lançamento de exceção quando a chave mestre OPENROUTER_API_KEY não está configurada."""
    mock_session = AsyncMock()
    mock_provider = AsyncMock(spec=OpenRouterLLMProvider)
    router = LLMEngineRouter(provider=mock_provider)

    with patch.object(settings, "OPENROUTER_API_KEY", ""):
        req = LLMCompletionRequest(prompt="Sem nenhuma chave")
        with pytest.raises(OpenRouterAPIError) as exc_info:
            await router.generate_completion(tenant_id="tenant_empty", prompt_data=req, db=mock_session)

        assert exc_info.value.status_code == 401
        assert "não configurada" in str(exc_info.value)
