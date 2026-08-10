import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
import respx
from httpx import Response
from tenacity import wait_none

from app.core.config.settings import settings
from app.core.security.crypto import encrypt_api_key
from app.features.ai_enrichment.domain.exceptions import (
    AllProvidersExhaustedError,
    LLMProviderError,
    OpenRouterAPIError,
    OpenRouterRateLimitError,
)
from app.features.ai_enrichment.infrastructure.providers.openrouter_provider import (
    DEFAULT_FALLBACK_MODELS,
    OpenRouterLLMProvider,
)
from app.features.ai_enrichment.schemas import (
    LLMCompletionRequest,
    LLMCompletionResponse,
)
from app.features.ai_enrichment.services.llm_router_service import LLMEngineRouter
from app.features.ai_enrichment.services.llm_service import LLMService
from app.features.products.domain.models import ProductModel, TenantConfigModel
from app.features.products.schemas import Product, ProductStatus, ScraperMetadata
from app.features.scraper.workers.processor_worker import ProcessorWorker


# ============================================================================
# 1. Testes do OpenRouterLLMProvider (Adapter Base)
# ============================================================================

@respx.mock
@pytest.mark.asyncio
async def test_openrouter_payload_contains_models_list() -> None:
    """Valida que a requisição POST envia o campo 'models' com a ordem de fallback padrão."""
    route = respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=Response(
            200,
            json={
                "model": "deepseek/deepseek-chat",
                "choices": [{"message": {"content": "Resposta de teste"}}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
            },
        )
    )

    provider = OpenRouterLLMProvider(api_key="sk-or-v1-testkey")
    req = LLMCompletionRequest(prompt="Gere uma copy para produto")

    res = await provider.generate_completion(req, api_key="sk-or-v1-testkey")

    assert res.content == "Resposta de teste"
    assert route.call_count == 1

    sent_body = json.loads(route.calls.last.request.content.decode("utf-8"))
    assert "models" in sent_body
    assert sent_body["models"] == [
        "deepseek/deepseek-chat",
        "meta-llama/llama-3.3-70b-instruct",
        "google/gemini-flash-1.5",
    ]


@respx.mock
@pytest.mark.asyncio
async def test_openrouter_extracts_model_used() -> None:
    """Simula que o modelo principal falhou no OpenRouter e o Meta Llama respondeu. Verifica se model_used é extraído corretamente."""
    respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=Response(
            200,
            json={
                "id": "gen-12345",
                "model": "meta-llama/llama-3.3-70b-instruct",
                "choices": [{"message": {"content": "Resposta via Llama 3.3"}}],
                "usage": {"prompt_tokens": 25, "completion_tokens": 15, "total_tokens": 40},
            },
        )
    )

    provider = OpenRouterLLMProvider(api_key="sk-or-v1-testkey")
    req = LLMCompletionRequest(prompt="Crie um título chamativo")

    res = await provider.generate_completion(req, api_key="sk-or-v1-testkey")

    assert res.model_used == "meta-llama/llama-3.3-70b-instruct"
    assert res.prompt_tokens == 25
    assert res.completion_tokens == 15
    assert res.total_tokens == 40
    assert res.provider_response_time_ms >= 0.0


# ============================================================================
# 2. Testes do LLMEngineRouter (Resolução de Chave & Resiliência)
# ============================================================================

@pytest.mark.asyncio
async def test_router_uses_global_master_key_directly() -> None:
    """Valida se o LLMEngineRouter efetua as chamadas utilizando diretamente a chave mestre global OPENROUTER_API_KEY."""
    mock_session = AsyncMock()
    mock_provider = AsyncMock(spec=OpenRouterLLMProvider)
    mock_provider.generate_completion.return_value = LLMCompletionResponse(
        content="Conteúdo via Chave Global do Sistema",
        model_used="deepseek/deepseek-chat",
        prompt_tokens=14,
        completion_tokens=7,
        total_tokens=21,
        provider_response_time_ms=88.5,
    )

    router = LLMEngineRouter(provider=mock_provider)

    with patch.object(settings, "OPENROUTER_API_KEY", "sk-or-v1-system-master-key"):
        req = LLMCompletionRequest(prompt="Prompt com chave mestre unificada")
        response = await router.generate_completion(tenant_id="tenant_premium", prompt_data=req, db=mock_session)

        assert response.content == "Conteúdo via Chave Global do Sistema"
        mock_provider.generate_completion.assert_called_once_with(
            request=req,
            api_key="sk-or-v1-system-master-key",
        )


@respx.mock
@pytest.mark.asyncio
async def test_router_retries_on_network_timeout() -> None:
    """Simula erros de timeout/503 nas duas primeiras tentativas HTTP e verifica a recuperação via retries do Tenacity."""
    route = respx.post("https://openrouter.ai/api/v1/chat/completions")
    route.side_effect = [
        Response(503, json={"error": "Service Unavailable"}),
        Response(503, json={"error": "Service Unavailable"}),
        Response(
            200,
            json={
                "model": "deepseek/deepseek-chat",
                "choices": [{"message": {"content": "Resposta recuperada pós-timeout"}}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
            },
        ),
    ]

    provider = OpenRouterLLMProvider(api_key="sk-or-v1-retrytest")
    provider._post_request.retry.wait = wait_none()  # desabilita sleep real nos testes

    req = LLMCompletionRequest(prompt="Teste de resiliência a timeout")
    with patch("asyncio.sleep", new_callable=AsyncMock):
        res = await provider.generate_completion(req, api_key="sk-or-v1-retrytest")

    assert res.content == "Resposta recuperada pós-timeout"
    assert route.call_count == 3


# ============================================================================
# 3. Testes do ProcessorWorker (Enriquecimento e Auditoria)
# ============================================================================

@pytest.mark.asyncio
async def test_worker_saves_enrichment_metadata() -> None:
    """Valida se o ProcessorWorker enriquece um produto RAW e salva os metadados de auditoria (model_used, tokens, response_time_ms)."""
    mock_repo = AsyncMock()
    mock_session = AsyncMock()

    raw_product_model = ProductModel(
        id="prod-uuid-101",
        tenant_id="tenant_audit_test",
        sku="SKU-AUDIT-101",
        title="Bolsa Feminina Couro",
        status=ProductStatus.RAW.value,
        raw_payload={
            "sku": "SKU-AUDIT-101",
            "title": "Bolsa Feminina Couro",
            "description": "Bolsa clássica de couro sintético",
            "price": 149.90,
            "tenant_id": "tenant_audit_test",
            "metadata": {"source_url": "https://loja.com/bolsa"},
        },
    )

    mock_db_result = MagicMock()
    mock_db_result.scalar_one_or_none.return_value = raw_product_model
    mock_session.execute.return_value = mock_db_result

    # Mock do LLMService e LLMEngineRouter
    mock_llm_service = AsyncMock(spec=LLMService)
    metadata_dict = {
        "model_used": "meta-llama/llama-3.3-70b-instruct",
        "prompt_tokens": 150,
        "completion_tokens": 85,
        "total_tokens": 235,
        "response_time_ms": 142.8,
    }

    enriched_product_return = Product(
        sku="SKU-AUDIT-101",
        title="[Otimizado] Bolsa Feminina de Couro Elegante",
        description="Descrição magnética em HTML com gatilhos mentais",
        price=149.90,
        status=ProductStatus.PROCESSED,
        tenant_id="tenant_audit_test",
        attributes={
            "seo_tags": "bolsa,couro,moda",
            "enrichment_metadata": json.dumps(metadata_dict),
        },
        metadata=ScraperMetadata(source_url="https://loja.com/bolsa"),
    )

    processor = ProcessorWorker(repo=mock_repo, llm=mock_llm_service, session=mock_session)

    with patch("app.features.ai_enrichment.services.LLMService.create_for_tenant", new_callable=AsyncMock) as mock_factory, patch.object(
        processor, "_process_with_retry", new_callable=AsyncMock
    ) as mock_retry:
        mock_factory.return_value = mock_llm_service
        mock_retry.return_value = enriched_product_return

        await processor._process_llm_task(tenant_id="tenant_audit_test", sku="SKU-AUDIT-101", queue_name="llm")

    # Garante que repo.upsert_product foi chamado com os dados de auditoria
    assert mock_repo.upsert_product.called
    saved_product = mock_repo.upsert_product.call_args[0][0]

    assert saved_product.status == ProductStatus.PROCESSED
    assert saved_product.title == "[Otimizado] Bolsa Feminina de Couro Elegante"
    assert "enrichment_metadata" in saved_product.attributes
    metadata = json.loads(saved_product.attributes["enrichment_metadata"])
    assert metadata["model_used"] == "meta-llama/llama-3.3-70b-instruct"
    assert metadata["prompt_tokens"] == 150
    assert metadata["completion_tokens"] == 85
    assert metadata["total_tokens"] == 235
    assert metadata["response_time_ms"] == 142.8


@pytest.mark.asyncio
async def test_worker_handles_critical_llm_failure() -> None:
    """Valida se o ProcessorWorker altera o status do produto para FAILED quando ocorre uma falha irrecuperável de LLM."""
    mock_repo = AsyncMock()
    mock_session = AsyncMock()

    raw_product_model = ProductModel(
        id="prod-uuid-102",
        tenant_id="tenant_failure_test",
        sku="SKU-FAIL-999",
        title="Produto Com Falha Critical",
        status=ProductStatus.RAW.value,
        raw_payload={
            "sku": "SKU-FAIL-999",
            "title": "Produto Com Falha Critical",
            "description": "Descrição original de teste",
            "tenant_id": "tenant_failure_test",
            "metadata": {"source_url": "https://loja.com/falha"},
        },
    )

    mock_db_result = MagicMock()
    mock_db_result.scalar_one_or_none.return_value = raw_product_model
    mock_session.execute.return_value = mock_db_result

    processor = ProcessorWorker(repo=mock_repo, llm=AsyncMock(), session=mock_session)

    with patch("app.features.ai_enrichment.services.LLMService.create_for_tenant", new_callable=AsyncMock) as mock_factory, patch.object(
        processor, "_process_with_retry", new_callable=AsyncMock
    ) as mock_retry:
        mock_factory.return_value = AsyncMock()
        mock_retry.side_effect = AllProvidersExhaustedError("Todos os provedores de LLM falharam após retries.")

        with pytest.raises(AllProvidersExhaustedError):
            await processor._process_llm_task(tenant_id="tenant_failure_test", sku="SKU-FAIL-999", queue_name="llm")

    # Verifica que o status foi alterado para FAILED no repositório
    mock_repo.set_status.assert_called_once_with("tenant_failure_test", "SKU-FAIL-999", ProductStatus.FAILED.value)
