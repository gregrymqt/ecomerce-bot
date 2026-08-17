import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.core.security.auth import get_current_tenant_user
from app.features.auth.schemas import AuthenticatedUser
from app.features.shopify.services.shopify_service import ShopifyService


@pytest.mark.asyncio
async def test_sync_bulk_catalog_success():
    mock_p1 = MagicMock()
    mock_p1.sku = "SKU-001"
    mock_p1.title = "Produto 1"
    mock_p1.raw_payload = {"title": "Produto 1", "price": 10.0}

    mock_p2 = MagicMock()
    mock_p2.sku = "SKU-002"
    mock_p2.title = "Produto 2"
    mock_p2.raw_payload = {"title": "Produto 2", "price": 20.0}

    mock_product_repo = AsyncMock()
    mock_product_repo.get_by_tenant_and_skus.return_value = [mock_p1, mock_p2]

    mock_client = AsyncMock()
    mock_client.create_staged_upload.return_value = {
        "stagedTargets": [
            {
                "url": "https://shopify-staged-uploads.cdn/upload",
                "parameters": [
                    {"name": "key", "value": "tmp/123/bulk_products.jsonl"},
                    {"name": "policy", "value": "encoded_policy_string"},
                ],
            }
        ]
    }
    mock_client.run_bulk_mutation.return_value = {
        "bulkOperation": {
            "id": "gid://shopify/BulkOperation/777",
            "status": "CREATED",
        }
    }

    mock_upload_response = MagicMock()
    mock_upload_response.status_code = 200

    service = ShopifyService(
        tenant_id="ecommerce_prod",
        product_repo=mock_product_repo,
        client=mock_client,
    )

    with patch("httpx.AsyncClient.post", return_value=mock_upload_response):
        result = await service.sync_bulk_catalog(["SKU-001", "SKU-002"])

        assert result["status"] == "accepted"
        assert result["bulk_operation"]["id"] == "gid://shopify/BulkOperation/777"
        assert result["processed_skus_count"] == 2
        mock_client.create_staged_upload.assert_called_once()
        mock_client.run_bulk_mutation.assert_called_once()


@pytest.mark.asyncio
async def test_process_bulk_operation_finish_success():
    mock_product_repo = AsyncMock()
    mock_client = AsyncMock()

    service = ShopifyService(
        tenant_id="ecommerce_prod",
        product_repo=mock_product_repo,
        client=mock_client,
    )

    jsonl_content = (
        '{"data": {"productSet": {"product": {"id": "gid://shopify/Product/101"}}}, "sku": "SKU-001"}\n'
        '{"data": {"productSet": {"product": {"id": "gid://shopify/Product/102"}}}, "sku": "SKU-002"}\n'
    )

    mock_get_response = MagicMock()
    mock_get_response.status_code = 200
    mock_get_response.text = jsonl_content

    with patch("httpx.AsyncClient.get", return_value=mock_get_response):
        payload = {"url": "https://storage.googleapis.com/shopify-bulk/result.jsonl"}
        result = await service.process_bulk_operation_finish(payload=payload)

        assert result["status"] == "completed"
        assert result["success_count"] == 2
        assert mock_product_repo.update_external_ids.call_count == 2


@pytest.mark.asyncio
async def test_bulk_sync_router_endpoint():
    mock_user = AuthenticatedUser(
        sub="user_123",
        email="admin@teste.com",
        name="Admin Teste",
        role="admin",
        tenants=["ecommerce_prod"],
    )

    app.dependency_overrides[get_current_tenant_user] = lambda: mock_user

    mock_shopify_service = AsyncMock()
    mock_shopify_service.sync_bulk_catalog.return_value = {
        "status": "accepted",
        "bulk_operation": {"id": "gid://shopify/BulkOperation/777", "status": "CREATED"},
    }

    headers = {
        "Authorization": "Bearer mock_token",
        "X-Tenant-ID": "ecommerce_prod",
    }

    from app.features.shopify.routers.shopify_bulk_router import get_shopify_bulk_service
    app.dependency_overrides[get_shopify_bulk_service] = lambda: mock_shopify_service

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/shopify/products/bulk-sync",
                json={"skus": ["SKU-001", "SKU-002"]},
                headers=headers,
            )
            assert response.status_code == 202
            data = response.json()
            assert data["status"] == "accepted"
    finally:
        app.dependency_overrides.clear()
