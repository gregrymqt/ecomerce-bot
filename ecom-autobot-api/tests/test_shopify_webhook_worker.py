import pytest
from unittest.mock import AsyncMock

from app.features.shopify.workers.webhook_worker import ShopifyWebhookWorker


@pytest.mark.asyncio
async def test_handle_products_update():
    mock_product_repo = AsyncMock()
    mock_shopify_repo = AsyncMock()
    mock_shopify_repo.get_tenant_by_shop_domain.return_value = "ecommerce_prod"

    worker = ShopifyWebhookWorker(
        product_repository=mock_product_repo,
        shopify_repository=mock_shopify_repo,
    )

    payload = {
        "id": 987654,
        "title": "T-Shirt Premium Black",
        "variants": [
            {"sku": "TSHIRT-BLK-L", "price": "99.90", "inventory_quantity": 50}
        ],
    }

    await worker.handle_event(
        topic="products/update",
        shop_domain="loja-teste.myshopify.com",
        payload=payload,
    )

    mock_shopify_repo.get_tenant_by_shop_domain.assert_called_once_with("loja-teste.myshopify.com")
    mock_product_repo.update_from_shopify_payload.assert_called_once_with(
        tenant_id="ecommerce_prod",
        sku="TSHIRT-BLK-L",
        title="T-Shirt Premium Black",
        shopify_product_id="987654",
        raw_payload_update={
            "title": "T-Shirt Premium Black",
            "body_html": None,
            "vendor": None,
            "product_type": None,
            "price": "99.90",
            "inventory_item_id": None,
            "stock": 50,
        },
    )


@pytest.mark.asyncio
async def test_handle_products_delete():
    mock_product_repo = AsyncMock()
    mock_shopify_repo = AsyncMock()
    mock_shopify_repo.get_tenant_by_shop_domain.return_value = "ecommerce_prod"

    worker = ShopifyWebhookWorker(
        product_repository=mock_product_repo,
        shopify_repository=mock_shopify_repo,
    )

    payload = {"id": 987654}

    await worker.handle_event(
        topic="products/delete",
        shop_domain="loja-teste.myshopify.com",
        payload=payload,
    )

    mock_shopify_repo.get_tenant_by_shop_domain.assert_called_once_with("loja-teste.myshopify.com")
    mock_product_repo.unlink_shopify_product.assert_called_once_with(
        tenant_id="ecommerce_prod",
        shopify_product_id="987654",
    )


@pytest.mark.asyncio
async def test_handle_app_uninstalled():
    mock_product_repo = AsyncMock()
    mock_shopify_repo = AsyncMock()
    mock_shopify_repo.get_tenant_by_shop_domain.return_value = "ecommerce_prod"

    worker = ShopifyWebhookWorker(
        product_repository=mock_product_repo,
        shopify_repository=mock_shopify_repo,
    )

    await worker.handle_event(
        topic="app/uninstalled",
        shop_domain="loja-teste.myshopify.com",
        payload={},
    )

    mock_shopify_repo.deactivate_integration.assert_called_once_with("loja-teste.myshopify.com")
