import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.core.config.settings import settings
from app.core.security.auth import get_current_tenant_user
from app.features.auth.schemas import AuthenticatedUser
from app.features.nuvemshop.services.nuvemshop_oauth_service import NuvemshopOAuthService


@pytest.mark.asyncio
async def test_nuvemshop_oauth_authorize_start():
    settings.NUVEMSHOP_CLIENT_ID = "12345"
    settings.NUVEMSHOP_SCOPES = "write_products,read_products"

    mock_user = AuthenticatedUser(
        sub="user_123",
        email="tenant@ecommerce.com",
        name="Tenant User",
        role="admin",
        tenants=["tenant_test_123"],
    )

    app.dependency_overrides[get_current_tenant_user] = lambda: mock_user

    try:
        with patch("app.core.config.redis_db.redis_cache.set", new_callable=AsyncMock) as mock_redis_set:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get(
                    "/api/v1/nuvemshop/oauth/authorize",
                    headers={"Authorization": "Bearer mock", "X-Tenant-ID": "tenant_test_123"},
                )

                assert response.status_code == 200
                data = response.json()
                assert "authorize_url" in data
                assert "state" in data
                assert "https://www.nuvemshop.com.br/apps/12345/authorize" in data["authorize_url"]
                assert "response_type=code" in data["authorize_url"]
                mock_redis_set.assert_called_once()
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_nuvemshop_oauth_callback_invalid_state():
    with patch("app.core.config.redis_db.redis_cache.get", new_callable=AsyncMock) as mock_redis_get:
        mock_redis_get.return_value = None

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/nuvemshop/oauth/callback?code=abc123code&state=invalid_state")

            assert response.status_code == 400
            data = response.json()
            assert "Token 'state' inválido ou expirado" in data["detail"]


@pytest.mark.asyncio
async def test_nuvemshop_oauth_callback_success():
    settings.NUVEMSHOP_CLIENT_ID = "12345"
    settings.NUVEMSHOP_CLIENT_SECRET = "secret_abc"
    settings.PUBLIC_BASE_URL = "https://my-app.com"

    mock_token_resp = {
        "access_token": "ns_access_token_xyz987",
        "token_type": "bearer",
        "scope": "write_products,read_products",
        "user_id": 998877,
    }

    with patch("app.core.config.redis_db.redis_cache.get", new_callable=AsyncMock) as mock_redis_get, \
         patch("app.core.config.redis_db.redis_cache.delete", new_callable=AsyncMock) as mock_redis_del, \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_http_post, \
         patch("app.features.products.repositories.tenant_config_repository.TenantConfigRepository.upsert", new_callable=AsyncMock) as mock_upsert, \
         patch.object(NuvemshopOAuthService, "auto_register_webhooks", new_callable=AsyncMock) as mock_auto_wh:

        mock_redis_get.return_value = "tenant_test_123"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = mock_token_resp
        mock_http_post.return_value = mock_response
        mock_auto_wh.return_value = [{"event": "product/created"}]

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/nuvemshop/oauth/callback?code=valid_code_123&state=valid_state_456")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"
            assert data["tenant_id"] == "tenant_test_123"
            assert data["store_id"] == 998877
            mock_upsert.assert_called_once()
            mock_auto_wh.assert_called_once_with(
                tenant_id="tenant_test_123",
                store_id=998877,
                access_token="ns_access_token_xyz987",
            )
