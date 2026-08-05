from typing import Any, Dict
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.products.domain.models import ProductModel, TenantConfigModel
from app.features.products.repositories import ProductRepository, TenantConfigRepository
from app.features.products.schemas import Product, ProductStatus, ScraperMetadata


@pytest.mark.asyncio
async def test_product_repository_multi_tenant_isolation(
    async_db_session: AsyncSession,
) -> None:
    """Garante o isolamento estrito de dados por tenant no ProductRepository."""
    repo = ProductRepository(session=async_db_session)

    # Inserção de produtos para o tenant_a
    prod_a1 = Product(
        sku="SKU-TEN-A-001",
        title="Produto Tenant A 1",
        status=ProductStatus.RAW,
        tenant_id="tenant_a",
        metadata=ScraperMetadata(source_url="https://loja-a.com/p1"),
    )
    prod_a2 = Product(
        sku="SKU-TEN-A-002",
        title="Produto Tenant A 2",
        status=ProductStatus.PROCESSED,
        tenant_id="tenant_a",
        metadata=ScraperMetadata(source_url="https://loja-a.com/p2"),
    )

    # Inserção de produtos para o tenant_b
    prod_b1 = Product(
        sku="SKU-TEN-B-001",
        title="Produto Tenant B 1",
        status=ProductStatus.RAW,
        tenant_id="tenant_b",
        metadata=ScraperMetadata(source_url="https://loja-b.com/p1"),
    )

    await repo.upsert_product(prod_a1)
    await repo.upsert_product(prod_a2)
    await repo.upsert_product(prod_b1)

    # Listagem de produtos para tenant_a
    products_a, total_a = await repo.list_products(tenant_id="tenant_a")
    assert total_a == 2
    assert len(products_a) == 2
    assert all(p.tenant_id == "tenant_a" for p in products_a)

    # Listagem de produtos para tenant_b
    products_b, total_b = await repo.list_products(tenant_id="tenant_b")
    assert total_b == 1
    assert len(products_b) == 1
    assert products_b[0].tenant_id == "tenant_b"
    assert products_b[0].sku == "SKU-TEN-B-001"

    # Tentativa do tenant_a buscar SKU do tenant_b deve retornar None
    cross_tenant_prod = await repo.get_by_tenant_and_sku(
        tenant_id="tenant_a", sku="SKU-TEN-B-001"
    )
    assert cross_tenant_prod is None


@pytest.mark.asyncio
async def test_tenant_config_repository_jsonb_payloads_and_isolation(
    async_db_session: AsyncSession,
) -> None:
    """Testa leitura, escrita e isolamento multi-tenant de payloads JSONB no TenantConfigModel."""
    repo = TenantConfigRepository(session=async_db_session)

    keys_a: Dict[str, Any] = {
        "deepseek_api_key": "enc_deepseek_key_tenant_a",
        "shopify_shop_domain": "loja-a.myshopify.com",
    }
    keys_b: Dict[str, Any] = {
        "groq_api_key": "enc_groq_key_tenant_b",
        "nuvemshop_store_id": "987654",
    }

    # Upsert de credenciais
    await repo.upsert("tenant_a", keys_a)
    await repo.upsert("tenant_b", keys_b)

    # Adiciona configurações de IA e Loja diretamente via model
    config_a_db = await async_db_session.get(TenantConfigModel, "tenant_a")
    assert config_a_db is not None
    config_a_db.ai_settings = {"tone": "persuasive", "language": "pt-BR"}
    config_a_db.pricing_settings = {"margin_multiplier": 1.3}
    config_a_db.store_profile = {"niche": "eletronicos", "brand_name": "Loja A Tech"}
    await async_db_session.commit()

    # Leitura das configurações via repository
    config_a = await repo.get("tenant_a")
    config_b = await repo.get("tenant_b")

    assert config_a is not None
    assert config_b is not None

    assert config_a.tenant_id == "tenant_a"
    assert config_a.encrypted_keys["deepseek_api_key"] == "enc_deepseek_key_tenant_a"
    assert config_a.ai_settings["tone"] == "persuasive"
    assert config_a.pricing_settings["margin_multiplier"] == 1.3
    assert config_a.store_profile["brand_name"] == "Loja A Tech"

    assert config_b.tenant_id == "tenant_b"
    assert config_b.encrypted_keys["groq_api_key"] == "enc_groq_key_tenant_b"
    assert "deepseek_api_key" not in config_b.encrypted_keys


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
