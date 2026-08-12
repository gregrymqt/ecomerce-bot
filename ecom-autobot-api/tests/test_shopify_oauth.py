import base64
import hashlib
import hmac
import pytest
from unittest.mock import AsyncMock, patch
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.core.config.settings import settings
from app.core.security.auth import get_current_tenant_user
from app.features.auth.schemas import AuthenticatedUser
from app.features.shopify.infrastructure.security import verify_shopify_oauth_hmac


def test_verify_shopify_oauth_hmac_valid():
    client_secret = "secret_key_123"
    params = {
        "code": "0907a61c0c270094f54e",
        "host": "bGFwdG9wLm15c2hvcGlmeS5jb20vYWRtaW4",
        "shop": "loja-teste.myshopify.com",
        "state": "state_uuid_12345",
        "timestamp": "1337178173",
    }

    # Ordena as chaves lexicograficamente e formata key=val
    message = "&".join([f"{k}={params[k]}" for k in sorted(params.keys())])
    computed_hex = hmac.new(client_secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()

    params_with_hmac = dict(params)
    params_with_hmac["hmac"] = computed_hex

    assert verify_shopify_oauth_hmac(params_with_hmac, client_secret) is True

    # Teste de falha com parâmetro alterado
    params_with_hmac["code"] = "invalid_code"
    assert verify_shopify_oauth_hmac(params_with_hmac, client_secret) is False


@pytest.mark.asyncio
async def test_shopify_auth_start():
    settings.SHOPIFY_CLIENT_ID = "test_client_id"
    settings.SHOPIFY_SCOPES = "read_products,write_products"
    settings.SHOPIFY_REDIRECT_URI = "https://api.teste.com/api/v1/shopify/auth/callback"

    headers = {
        "Authorization": "Bearer mock_token",
        "X-Tenant-ID": "ecommerce_prod",
    }

    mock_user = AuthenticatedUser(
        sub="user_123",
        email="admin@teste.com",
        name="Admin Teste",
        role="admin",
        tenants=["ecommerce_prod"],
    )

    app.dependency_overrides[get_current_tenant_user] = lambda: mock_user

    try:
        with patch("app.core.config.redis_db.redis_cache.set", new_callable=AsyncMock) as mock_redis_set:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get(
                    "/api/v1/shopify/auth?shop=loja-maria.myshopify.com",
                    headers=headers,
                )

                assert response.status_code == 200
                data = response.json()
                assert "authorize_url" in data
                authorize_url = data["authorize_url"]
                assert "https://loja-maria.myshopify.com/admin/oauth/authorize" in authorize_url
                assert "client_id=test_client_id" in authorize_url
                assert "grant_options[]=offline" in authorize_url
                mock_redis_set.assert_called_once()
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_shopify_auth_callback_success():
    client_secret = "secret_key_123"
    settings.SHOPIFY_CLIENT_ID = "test_client_id"
    settings.SHOPIFY_CLIENT_SECRET = client_secret
    settings.FRONTEND_URL = "http://localhost:5173"

    params = {
        "code": "code_xyz_123",
        "shop": "loja-teste.myshopify.com",
        "state": "state_uuid_12345",
        "timestamp": "1337178173",
    }

    message = "&".join([f"{k}={params[k]}" for k in sorted(params.keys())])
    computed_hex = hmac.new(client_secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()
    params["hmac"] = computed_hex

    from unittest.mock import MagicMock
    mock_token_response = MagicMock()
    mock_token_response.status_code = 200
    mock_token_response.json.return_value = {"access_token": "shpat_offline_token_999"}

    mock_repo_inst = AsyncMock()
    mock_service_inst = AsyncMock()

    with patch("app.core.config.redis_db.redis_cache.get", new_callable=AsyncMock) as mock_redis_get, \
         patch("httpx.AsyncClient.post", return_value=mock_token_response), \
         patch("app.features.shopify.services.shopify_auth_service.ShopifyRepository", return_value=mock_repo_inst), \
         patch("app.features.shopify.services.shopify_auth_service.ShopifyService", return_value=mock_service_inst):

        mock_redis_get.return_value = "ecommerce_prod"

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(
                "/api/v1/shopify/auth/callback",
                params=params,
                follow_redirects=False,
            )

            assert response.status_code == 307
            redirect_url = response.headers.get("location")
            assert redirect_url == "http://localhost:5173/catalog?shopify_connected=true&shop=loja-teste.myshopify.com"
            mock_repo_inst.save_integration.assert_called_once_with(
                tenant_id="ecommerce_prod",
                shop_domain="loja-teste.myshopify.com",
                access_token="shpat_offline_token_999",
            )
            mock_service_inst.register_app_webhooks.assert_called_once_with(
                shop_domain="loja-teste.myshopify.com",
                access_token="shpat_offline_token_999",
            )
