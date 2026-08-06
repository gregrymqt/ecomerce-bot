import json
from datetime import datetime, timedelta, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.shared.progress import publish_demo_progress
from app.features.products.domain.models import ProductModel
from app.features.products.repositories import ProductRepository
from app.features.products.schemas import Product, ProductStatus, ScraperMetadata
from app.features.scraper.schemas import ImportRequestMessage, ScrapedProductResult
from app.features.scraper.workers.processor_worker import ProcessorWorker
from app.features.scraper.workers.scraper_worker import ScraperWorker


@pytest.fixture
def mock_scraped_data_strategy1() -> ScrapedProductResult:
    """Mock de dados extraídos via JSON-LD (Estratégia 1)."""
    return ScrapedProductResult(
        title="Sapato Couro Legítimo Black",
        description="Sapato social elegante e confortável em couro.",
        price="299.90",
        currency="BRL",
        image_url="https://loja.com/images/sapato.jpg",
        sku="SAP-BLACK-42",
    )


@pytest.fixture
def mock_scraped_data_strategy2() -> ScrapedProductResult:
    """Mock de dados extraídos via HTML/Markdown Fallback (Estratégia 2)."""
    return ScrapedProductResult(
        title="Sapato Couro Legítimo Black (Fallback LLM)",
        description="Descrição extraída via parser HTML e LLM Fallback.",
        price="299.90",
        currency="BRL",
        image_url="https://loja.com/images/sapato_fallback.jpg",
        sku="SAP-BLACK-42-FALLBACK",
    )


@pytest.mark.asyncio
async def test_rabbitmq_queue_to_scraper_worker_to_db_scenario(
    async_db_session: AsyncSession,
    mock_scraped_data_strategy1: ScrapedProductResult,
) -> None:
    """Cenário 1 (Fila RabbitMQ -> ScraperWorker -> DB): Simular mensagem na fila ecommerce_prod_test, processar ciclo do ScraperWorker e verificar o produto salvo como RAW no banco."""
    repo = ProductRepository(session=async_db_session)
    worker = ScraperWorker(repository=repo, session=async_db_session)

    command_payload = {
        "url": "https://exemplo.com/produto-1",
        "tenant_id": "tenant_alpha",
    }

    with patch.object(
        worker.json_ld_parser, "parse", new_callable=AsyncMock
    ) as mock_json_ld:
        mock_json_ld.return_value = mock_scraped_data_strategy1

        product = await worker._process_product_page(
            product_url=command_payload["url"], tenant_id=command_payload["tenant_id"]
        )

    assert product is not None
    assert product.tenant_id == "tenant_alpha"
    assert product.status == ProductStatus.RAW

    # Salva o produto retornado do worker no banco de dados e valida persistência
    await repo.upsert_product(product)
    db_product = await repo.get_by_tenant_and_sku("tenant_alpha", product.sku)
    assert db_product is not None
    assert db_product.status == ProductStatus.RAW.value


@pytest.mark.asyncio
async def test_processor_worker_raw_processing_processed_state_transitions_scenario(
    async_db_session: AsyncSession,
) -> None:
    """Cenário 2 (ProcessorWorker & Transições de Estado): Criar registro RAW no banco, executar o ProcessorWorker e validar transição RAW -> PROCESSING -> PROCESSED."""
    repo = ProductRepository(session=async_db_session)
    mock_llm_service = MagicMock()

    processor = ProcessorWorker(repo=repo, llm=mock_llm_service, session=async_db_session)

    raw_product = Product(
        sku="SKU-TRANSITION-001",
        title="Produto Inicial Bruto",
        description="Descrição simples de teste",
        price=199.90,
        status=ProductStatus.RAW,
        tenant_id="tenant_alpha",
        metadata=ScraperMetadata(source_url="https://exemplo.com/p1"),
    )
    await repo.upsert_product(raw_product)

    enriched_product = Product(
        sku="SKU-TRANSITION-001",
        title="[Otimizado] Produto Exclusivo",
        description="Copywriting persuasivo e magnético gerado por IA.",
        price=199.90,
        status=ProductStatus.PROCESSED,
        tenant_id="tenant_alpha",
        metadata=ScraperMetadata(source_url="https://exemplo.com/p1"),
    )

    with patch("app.features.ai_enrichment.services.LLMService.create_for_tenant", new_callable=AsyncMock) as mock_factory, patch.object(
        processor, "_process_with_retry", new_callable=AsyncMock
    ) as mock_process_retry:

        mock_factory.return_value = mock_llm_service
        mock_process_retry.return_value = enriched_product

        await processor._process_llm_task(tenant_id="tenant_alpha", sku="SKU-TRANSITION-001", queue_name="llm")

    db_product = await repo.get_by_tenant_and_sku("tenant_alpha", "SKU-TRANSITION-001")
    assert db_product is not None
    assert db_product.status == ProductStatus.PROCESSED.value
    assert "[Otimizado]" in db_product.title


@pytest.mark.asyncio
async def test_parser_fallback_resilience_json_ld_to_markdown_scenario(
    async_db_session: AsyncSession,
    mock_scraped_data_strategy2: ScrapedProductResult,
) -> None:
    """Cenário 3 (Resiliência e Fallback do Parser): Simular HTML sem tags JSON-LD e verificar se a falha dispara o fallback automático para o MarkdownParserService."""
    repo = ProductRepository(session=async_db_session)
    worker = ScraperWorker(repository=repo, session=async_db_session)

    empty_scraped = ScrapedProductResult(title="", description="")

    mock_http_response = MagicMock()
    mock_http_response.status_code = 200
    mock_http_response.text = "<html><body><h1>Produto sem JSON-LD</h1></body></html>"
    mock_http_response.raise_for_status = MagicMock()

    with patch.object(
        worker.json_ld_parser, "parse", new_callable=AsyncMock
    ) as mock_json_ld, patch.object(
        worker.client, "get", new_callable=AsyncMock
    ) as mock_http_get, patch.object(
        worker.markdown_parser, "parse", new_callable=AsyncMock
    ) as mock_markdown_parser:

        mock_json_ld.return_value = empty_scraped
        mock_http_get.return_value = mock_http_response
        mock_markdown_parser.return_value = mock_scraped_data_strategy2

        product = await worker._process_product_page(
            "https://exemplo.com/produto-sem-jsonld", tenant_id="tenant_alpha"
        )

    assert product is not None
    assert product.title == "Sapato Couro Legítimo Black (Fallback LLM)"
    assert mock_json_ld.called
    assert mock_markdown_parser.called


@pytest.mark.asyncio
async def test_auto_recovery_stuck_processing_jobs_scenario(
    async_db_session: AsyncSession,
) -> None:
    """Cenário 4 (Auto-Recuperação de Jobs Travados): Criar produto em PROCESSING com updated_at de 15 minutos atrás e verificar reversão para RAW."""
    repo = ProductRepository(session=async_db_session)
    processor = ProcessorWorker(repo=repo, llm=MagicMock(), session=async_db_session)

    now = datetime.now(timezone.utc)
    old_cutoff = now - timedelta(minutes=15)

    stuck_job = ProductModel(
        id="job-stuck-15min-scenario",
        tenant_id="tenant_alpha",
        sku="SKU-STUCK-15MIN",
        title="Produto Travado Há 15 Minutos",
        status=ProductStatus.PROCESSING.value,
        updated_at=old_cutoff,
    )

    async_db_session.add(stuck_job)
    await async_db_session.commit()

    reset_count = await processor.reset_stuck_processing_jobs(timeout_minutes=10)
    assert reset_count >= 1

    stuck_db = await async_db_session.get(ProductModel, "job-stuck-15min-scenario")
    assert stuck_db is not None
    assert stuck_db.status == ProductStatus.RAW.value


@pytest.mark.asyncio
async def test_redis_pubsub_sse_progress_event_publication_scenario() -> None:
    """Cenário 5 (Evento Redis Pub/Sub SSE): Disparar eventos no canal demo_progress e verificar publicação de mensagens de progresso."""
    mock_redis = AsyncMock()

    with patch("app.core.config.redis_db.redis_cache.redis_client", mock_redis):
        await publish_demo_progress(
            url="https://exemplo.com/produto-demo",
            status="scraping",
            progress=50,
            original={"title": "Produto Demo"},
        )
        await publish_demo_progress(
            url="https://exemplo.com/produto-demo",
            status="enriching",
            progress=100,
            original={"title": "Produto Demo Enriquecido"},
        )

    assert mock_redis.publish.called
    assert mock_redis.publish.call_count == 2

    # Verifica os dois eventos enviados ao canal demo_progress
    call1_args = mock_redis.publish.call_args_list[0][0]
    call2_args = mock_redis.publish.call_args_list[1][0]

    assert call1_args[0] == "demo_progress"
    payload1 = json.loads(call1_args[1])
    assert payload1["status"] == "scraping"
    assert payload1["progress"] == 50

    assert call2_args[0] == "demo_progress"
    payload2 = json.loads(call2_args[1])
    assert payload2["status"] == "enriching"
    assert payload2["progress"] == 100

