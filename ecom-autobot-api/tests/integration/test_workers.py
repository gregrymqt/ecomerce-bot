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
async def test_scraper_worker_processing_page_strategy_1_success(
    async_db_session: AsyncSession,
    mock_scraped_data_strategy1: ScrapedProductResult,
) -> None:
    """Simula o scraping bem-sucedido de uma página usando a Estratégia 1 (JSON-LD)."""
    repo = ProductRepository(session=async_db_session)
    worker = ScraperWorker(repository=repo, session=async_db_session)

    with patch.object(
        worker.json_ld_parser, "parse", new_callable=AsyncMock
    ) as mock_json_ld:
        mock_json_ld.return_value = mock_scraped_data_strategy1

        product = await worker._process_product_page(
            "https://loja.com/produtos/sapato-black", tenant_id="tenant_qa"
        )

    assert product is not None
    assert product.sku == "SAP-BLACK-42"
    assert product.title == "Sapato Couro Legítimo Black"
    assert product.status == ProductStatus.RAW
    assert product.tenant_id == "tenant_qa"


@pytest.mark.asyncio
async def test_scraper_worker_parser_fallback_resilience(
    async_db_session: AsyncSession,
    mock_scraped_data_strategy2: ScrapedProductResult,
) -> None:
    """Testa a resiliência do ScraperWorker: falha no JSON-LD (Estratégia 1) aciona o fallback HTML/Markdown (Estratégia 2)."""
    repo = ProductRepository(session=async_db_session)
    worker = ScraperWorker(repository=repo, session=async_db_session)

    # 1. Estratégia 1 retorna dados vazios/nulos
    empty_scraped = ScrapedProductResult(title="", description="")

    # Mock da resposta HTTP da página
    mock_http_response = MagicMock()
    mock_http_response.status_code = 200
    mock_http_response.text = "<html><body><h1>Produto Fallback</h1></body></html>"
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
            "https://loja.com/produtos/sapato-fallback", tenant_id="tenant_qa"
        )

    assert product is not None
    assert product.title == "Sapato Couro Legítimo Black (Fallback LLM)"
    assert mock_json_ld.called
    assert mock_markdown_parser.called


@pytest.mark.asyncio
async def test_processor_worker_state_transition_raw_processing_processed(
    async_db_session: AsyncSession,
) -> None:
    """Testa o pipeline do ProcessorWorker: transição de estado RAW -> PROCESSING -> PROCESSED."""
    repo = ProductRepository(session=async_db_session)
    mock_llm_service = MagicMock()

    processor = ProcessorWorker(repo=repo, llm=mock_llm_service, session=async_db_session)

    # Insere produto inicial em estado RAW
    raw_product = Product(
        sku="SKU-LLM-001",
        title="Produto Bruto Sem Enriquecimento",
        description="Descrição simples",
        price=150.0,
        status=ProductStatus.RAW,
        tenant_id="tenant_qa",
        metadata=ScraperMetadata(source_url="https://loja.com/p-llm"),
    )
    await repo.upsert_product(raw_product)

    # Mock do retorno enriquecido pela LLM
    enriched_product = Product(
        sku="SKU-LLM-001",
        title="[Enriquecido] Produto Premium Exclusivo",
        description="Copywriting magnético e persuasivo gerado pela IA.",
        price=150.0,
        status=ProductStatus.PROCESSED,
        tenant_id="tenant_qa",
        metadata=ScraperMetadata(source_url="https://loja.com/p-llm"),
    )

    with patch("app.features.ai_enrichment.services.LLMService.create_for_tenant", new_callable=AsyncMock) as mock_factory, patch.object(
        processor, "_process_with_retry", new_callable=AsyncMock
    ) as mock_process_retry:

        mock_factory.return_value = mock_llm_service
        mock_process_retry.return_value = enriched_product

        await processor._process_llm_task(tenant_id="tenant_qa", sku="SKU-LLM-001", queue_name="llm")

    # Verifica se o estado final no banco de dados foi atualizado para PROCESSED
    db_product = await repo.get_by_tenant_and_sku("tenant_qa", "SKU-LLM-001")
    assert db_product is not None
    assert db_product.status == ProductStatus.PROCESSED.value
    assert db_product.title == "[Enriquecido] Produto Premium Exclusivo"


@pytest.mark.asyncio
async def test_processor_worker_reset_stuck_processing_jobs(
    async_db_session: AsyncSession,
) -> None:
    """Testa a rotina reset_stuck_processing_jobs: reseta apenas jobs em 'PROCESSING' há mais de 10 minutos."""
    repo = ProductRepository(session=async_db_session)
    processor = ProcessorWorker(repo=repo, llm=MagicMock(), session=async_db_session)

    now = datetime.now(timezone.utc)
    old_cutoff = now - timedelta(minutes=15)
    recent_cutoff = now - timedelta(minutes=2)

    # Job travado há 15 minutos
    stuck_job = ProductModel(
        id="job-stuck-15min",
        tenant_id="tenant_qa",
        sku="SKU-STUCK-01",
        title="Produto Travado 15 Minutos",
        status=ProductStatus.PROCESSING.value,
        updated_at=old_cutoff,
    )

    # Job recente em processamento há apenas 2 minutos
    active_job = ProductModel(
        id="job-active-2min",
        tenant_id="tenant_qa",
        sku="SKU-ACTIVE-02",
        title="Produto Ativo 2 Minutos",
        status=ProductStatus.PROCESSING.value,
        updated_at=recent_cutoff,
    )

    async_db_session.add(stuck_job)
    async_db_session.add(active_job)
    await async_db_session.commit()

    # Executa o reset de jobs travados (> 10 min)
    reset_count = await processor.reset_stuck_processing_jobs(timeout_minutes=10)

    assert reset_count == 1

    # Verifica os estados dos dois registros no banco
    stuck_db = await async_db_session.get(ProductModel, "job-stuck-15min")
    active_db = await async_db_session.get(ProductModel, "job-active-2min")

    assert stuck_db is not None
    assert active_db is not None

    # Job antigo deve ter sido resetado de volta para RAW
    assert stuck_db.status == ProductStatus.RAW.value

    # Job recente deve permanecer em PROCESSING
    assert active_db.status == ProductStatus.PROCESSING.value


@pytest.mark.asyncio
async def test_redis_pubsub_sse_progress_publication() -> None:
    """Testa a publicação de atualizações de progresso no Redis Pub/Sub no canal 'demo_progress'."""
    mock_redis = AsyncMock()

    with patch("app.core.config.redis_db.redis_cache.redis_client", mock_redis):
        await publish_demo_progress(
            url="https://loja.com/produto-demo",
            status="processing",
            progress=50,
            original={"title": "Título Original"},
        )

    assert mock_redis.publish.called
    channel_arg, payload_str = mock_redis.publish.call_args[0]

    assert channel_arg == "demo_progress"

    payload_data = json.loads(payload_str)
    assert payload_data["url"] == "https://loja.com/produto-demo"
    assert payload_data["status"] == "processing"
    assert payload_data["progress"] == 50
    assert payload_data["original"]["title"] == "Título Original"
