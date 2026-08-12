import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.core.security.auth import get_current_tenant_user
from app.features.auth.schemas import AuthenticatedUser
from app.features.shopify.services.shopify_service import ShopifyService


@pytest.mark.asyncio
async def test_inventory_set_quantities_success():
    mock_product = MagicMock()
    mock_product.shopify_product_id = "gid://shopify/Product/987654"
    mock_product.raw_payload = {
        "variants": [{"inventory_item_id": "gid://shopify/InventoryItem/112233"}]
    }

    mock_product_repo = AsyncMock()
    mock_product_repo.get_by_tenant_and_sku.return_value = mock_product

    mock_client = AsyncMock()
    mock_client.get_primary_location_id.return_value = "gid://shopify/Location/999"
    mock_client.set_inventory_quantity.return_value = {
        "inventoryAdjustmentGroup": {"reason": "correction"}
    }

    service = ShopifyService(
        tenant_id="ecommerce_prod",
        product_repo=mock_product_repo,
        client=mock_client,
    )

    result = await service.update_inventory_by_sku(
        sku="TSHIRT-BLK-L",
        quantity=80,
    )

    mock_client.set_inventory_quantity.assert_called_once_with(
        inventory_item_id="gid://shopify/InventoryItem/112233",
        location_id="gid://shopify/Location/999",
        quantity=80,
    )
    assert result == {"inventoryAdjustmentGroup": {"reason": "correction"}}



@pytest.mark.asyncio
async def test_delete_remote_product_success():
    mock_product = MagicMock()
    mock_product.shopify_product_id = "gid://shopify/Product/987654"

    mock_product_repo = AsyncMock()
    mock_product_repo.get_by_tenant_and_sku.return_value = mock_product

    mock_client = AsyncMock()
    mock_client.delete_product.return_value = "gid://shopify/Product/987654"

    service = ShopifyService(
        tenant_id="ecommerce_prod",
        product_repo=mock_product_repo,
        client=mock_client,
    )

    result = await service.delete_remote_product_by_sku("TSHIRT-BLK-L")

    mock_client.delete_product.assert_called_once_with(
        product_id="gid://shopify/Product/987654"
    )
    mock_product_repo.unlink_shopify_product.assert_called_once_with(
        tenant_id="ecommerce_prod",
        shopify_product_id="gid://shopify/Product/987654",
    )
    assert result["status"] == "success"
    assert result["deleted_product_id"] == "gid://shopify/Product/987654"


@pytest.mark.asyncio
async def test_change_product_status_success():
    mock_product = MagicMock()
    mock_product.shopify_product_id = "gid://shopify/Product/987654"

    mock_product_repo = AsyncMock()
    mock_product_repo.get_by_tenant_and_sku.return_value = mock_product

    mock_client = AsyncMock()
    mock_client.update_product_status.return_value = {
        "product": {"id": "gid://shopify/Product/987654", "status": "ACTIVE"}
    }

    service = ShopifyService(
        tenant_id="ecommerce_prod",
        product_repo=mock_product_repo,
        client=mock_client,
    )

    result = await service.change_product_status_by_sku("TSHIRT-BLK-L", "ACTIVE")

    mock_client.update_product_status.assert_called_once_with(
        product_id="gid://shopify/Product/987654",
        status="ACTIVE",
    )
    assert result["product"]["status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_router_crud_endpoints():
    mock_user = AuthenticatedUser(
        sub="user_123",
        email="admin@teste.com",
        name="Admin Teste",
        role="admin",
        tenants=["ecommerce_prod"],
    )

    app.dependency_overrides[get_current_tenant_user] = lambda: mock_user

    mock_shopify_service = AsyncMock()
    mock_shopify_service.update_inventory_by_sku.return_value = {"status": "success", "available": 50}
    mock_shopify_service.change_product_status_by_sku.return_value = {"status": "success", "new_status": "ACTIVE"}
    mock_shopify_service.delete_remote_product_by_sku.return_value = {"status": "success", "deleted_product_id": "gid://shopify/Product/123"}

    headers = {
        "Authorization": "Bearer mock_token",
        "X-Tenant-ID": "ecommerce_prod",
    }

    from app.features.shopify.router import get_shopify_service
    app.dependency_overrides[get_shopify_service] = lambda: mock_shopify_service

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. PATCH inventory
            inv_resp = await client.patch(
                "/api/v1/shopify/products/TSHIRT-BLK-L/inventory",
                json={"available_quantity": 50},
                headers=headers,
            )
            assert inv_resp.status_code == 200

            # 2. PATCH status
            st_resp = await client.patch(
                "/api/v1/shopify/products/TSHIRT-BLK-L/status",
                json={"status": "ACTIVE"},
                headers=headers,
            )
            assert st_resp.status_code == 200

            # 3. DELETE product
            del_resp = await client.delete(
                "/api/v1/shopify/products/TSHIRT-BLK-L",
                headers=headers,
            )
            assert del_resp.status_code == 200
    finally:
        app.dependency_overrides.clear()
