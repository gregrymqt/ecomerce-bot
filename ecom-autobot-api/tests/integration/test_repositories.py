from typing import Any, Dict
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.products.domain.models import ProductModel, TenantConfigModel
from app.features.products.repositories import ProductRepository, TenantConfigRepository
from app.features.products.schemas import Product, ProductStatus, ScraperMetadata


@pytest.mark.asyncio
async def test_strict_multi_tenant_isolation_scenario(
    async_db_session: AsyncSession,
) -> None:
    """Cenário 1 (Isolamento Multi-Tenant Estrito): Inserir 3 produtos sob tenant_alpha e 2 sob tenant_beta. Assertar que a busca por tenant_alpha retorna EXATAMENTE 3 produtos."""
    repo = ProductRepository(session=async_db_session)

    # Inserção de 3 produtos para tenant_alpha
    for i in range(1, 4):
        await repo.upsert_product(
            Product(
                sku=f"SKU-ALPHA-00{i}",
                title=f"Produto Alpha {i}",
                status=ProductStatus.RAW,
                tenant_id="tenant_alpha",
                metadata=ScraperMetadata(source_url=f"https://loja-alpha.com/p{i}"),
            )
        )

    # Inserção de 2 produtos para tenant_beta
    for i in range(1, 3):
        await repo.upsert_product(
            Product(
                sku=f"SKU-BETA-00{i}",
                title=f"Produto Beta {i}",
                status=ProductStatus.RAW,
                tenant_id="tenant_beta",
                metadata=ScraperMetadata(source_url=f"https://loja-beta.com/p{i}"),
            )
        )

    # Busca list_products para tenant_alpha deve retornar EXATAMENTE 3 produtos
    products_alpha, total_alpha = await repo.list_products(tenant_id="tenant_alpha")
    assert total_alpha == 3
    assert len(products_alpha) == 3
    assert all(p.tenant_id == "tenant_alpha" for p in products_alpha)

    # Busca list_products para tenant_beta deve retornar EXATAMENTE 2 produtos
    products_beta, total_beta = await repo.list_products(tenant_id="tenant_beta")
    assert total_beta == 2
    assert len(products_beta) == 2

    # Tentar buscar SKU do tenant_beta informando tenant_id="tenant_alpha" deve retornar None
    cross_tenant_result = await repo.get_by_tenant_and_sku(
        tenant_id="tenant_alpha", sku="SKU-BETA-001"
    )
    assert cross_tenant_result is None


@pytest.mark.asyncio
async def test_tenant_config_jsonb_persistence_and_type_integrity(
    async_db_session: AsyncSession,
) -> None:
    """Cenário 2 (Persistência e Leitura do JSONB de Configurações): Gravar TenantConfigModel com JSONB de regras de IA e validar integridade e tipos."""
    repo = TenantConfigRepository(session=async_db_session)

    config_model = TenantConfigModel(
        tenant_id="tenant_alpha",
        encrypted_keys={},
        ai_settings={
            "tone": "agressivo",
            "target_audience": "dropshippers",
            "margin_percentage": 25.5,
        },
    )
    async_db_session.add(config_model)
    await async_db_session.commit()

    retrieved = await repo.get("tenant_alpha")
    assert retrieved is not None
    assert retrieved.tenant_id == "tenant_alpha"
    assert retrieved.ai_settings is not None
    assert retrieved.ai_settings["tone"] == "agressivo"
    assert retrieved.ai_settings["target_audience"] == "dropshippers"
    assert retrieved.ai_settings["margin_percentage"] == 25.5
    assert isinstance(retrieved.ai_settings["margin_percentage"], float)
    assert isinstance(retrieved.ai_settings["tone"], str)


@pytest.mark.asyncio
async def test_product_repository_crud_filters_and_deletion(
    async_db_session: AsyncSession,
) -> None:
    """Testa atualização de status, buscas paginadas, filtros por termo/status e remoção de produtos."""
    repo = ProductRepository(session=async_db_session)
    tenant_id = "tenant_test_qa"

    prod1 = Product(
        sku="SKU-CAMISA-001",
        title="Camisa Polo Masculina Slim",
        status=ProductStatus.RAW,
        tenant_id=tenant_id,
        metadata=ScraperMetadata(source_url="https://loja.com/camisa-polo"),
    )
    prod2 = Product(
        sku="SKU-CALCA-002",
        title="Calça Jeans Premium Skinny",
        status=ProductStatus.PROCESSED,
        tenant_id=tenant_id,
        metadata=ScraperMetadata(source_url="https://loja.com/calca-jeans"),
    )

    await repo.upsert_product(prod1)
    await repo.upsert_product(prod2)

    # 1. Filtro por status (PROCESSED)
    processed_list, count_processed = await repo.list_products(
        tenant_id=tenant_id, status=ProductStatus.PROCESSED.value
    )
    assert count_processed == 1
    assert processed_list[0].sku == "SKU-CALCA-002"

    # 2. Busca por termo ("Camisa")
    search_list, count_search = await repo.list_products(
        tenant_id=tenant_id, search="Camisa"
    )
    assert count_search == 1
    assert search_list[0].sku == "SKU-CAMISA-001"

    # 3. Atualização de status via set_status
    await repo.set_status(tenant_id, "SKU-CAMISA-001", ProductStatus.PROCESSING.value)
    updated_prod = await repo.get_by_tenant_and_sku(tenant_id, "SKU-CAMISA-001")
    assert updated_prod is not None
    assert updated_prod.status == ProductStatus.PROCESSING.value

    # 4. Remoção de produto delete_product
    deleted = await repo.delete_product(tenant_id, "SKU-CAMISA-001")
    assert deleted is True

    remaining, remaining_count = await repo.list_products(tenant_id=tenant_id)
    assert remaining_count == 1
    assert remaining[0].sku == "SKU-CALCA-002"
