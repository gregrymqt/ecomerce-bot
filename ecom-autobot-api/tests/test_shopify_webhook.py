import base64
import hashlib
import hmac
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.core.config.settings import settings
from app.features.shopify.infrastructure.security import verify_shopify_webhook_hmac


@pytest.mark.asyncio
async def test_verify_shopify_webhook_hmac_valid():
    secret = "test_webhook_secret_key_123"
    raw_body = b'{"id": 12345, "title": "Test Product"}'

    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
    valid_hmac = base64.b64encode(digest).decode("utf-8")

    assert verify_shopify_webhook_hmac(raw_body, valid_hmac, secret) is True
    assert verify_shopify_webhook_hmac(raw_body, "invalid_hmac_signature", secret) is False
    assert verify_shopify_webhook_hmac(raw_body, valid_hmac, "") is False


@pytest.mark.asyncio
async def test_shopify_webhook_invalid_hmac():
    settings.SHOPIFY_WEBHOOK_SECRET = "test_secret"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/shopify/webhooks",
            content=b'{"id": 123}',
            headers={
                "X-Shopify-Hmac-Sha256": "invalid_signature",
                "X-Shopify-Webhook-Id": "wh_123",
                "X-Shopify-Shop-Domain": "test-shop.myshopify.com",
                "X-Shopify-Topic": "products/update",
            },
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Assinatura HMAC inválida"


@pytest.mark.asyncio
async def test_shopify_webhook_queued():
    secret = "test_secret_321"
    settings.SHOPIFY_WEBHOOK_SECRET = secret
    raw_body = b'{"id": 9999, "title": "Webhooks Test"}'

    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
    valid_hmac = base64.b64encode(digest).decode("utf-8")

    with patch("app.features.shopify.services.shopify_webhook_service.redis_cache.get", new_callable=AsyncMock) as mock_redis_get, \
         patch("app.features.shopify.services.shopify_webhook_service.redis_cache.set", new_callable=AsyncMock) as mock_redis_set, \
         patch("app.features.shopify.services.shopify_webhook_service.get_rabbitmq_connection", new_callable=AsyncMock) as mock_rabbitmq_conn:

        mock_redis_get.return_value = None

        mock_conn_inst = AsyncMock()
        mock_channel_inst = AsyncMock()
        mock_conn_inst.channel.return_value = mock_channel_inst
        mock_conn_inst.__aenter__.return_value = mock_conn_inst
        mock_conn_inst.__aexit__.return_value = None
        mock_rabbitmq_conn.return_value = mock_conn_inst

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/shopify/webhooks",
                content=raw_body,
                headers={
                    "X-Shopify-Hmac-Sha256": valid_hmac,
                    "X-Shopify-Webhook-Id": "webhook_event_001",
                    "X-Shopify-Shop-Domain": "loja-teste.myshopify.com",
                    "X-Shopify-Topic": "products/update",
                },
            )

            assert response.status_code == 200
            assert response.json() == {"status": "queued"}
            mock_redis_set.assert_called_once_with("shopify:webhook:webhook_event_001", "1", expire_seconds=86400)


@pytest.mark.asyncio
async def test_shopify_webhook_already_processed():
    secret = "test_secret_321"
    settings.SHOPIFY_WEBHOOK_SECRET = secret
    raw_body = b'{"id": 9999}'

    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
    valid_hmac = base64.b64encode(digest).decode("utf-8")

    with patch("app.features.shopify.services.shopify_webhook_service.redis_cache.get", new_callable=AsyncMock) as mock_redis_get:
        mock_redis_get.return_value = "1"

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/shopify/webhooks",
                content=raw_body,
                headers={
                    "X-Shopify-Hmac-Sha256": valid_hmac,
                    "X-Shopify-Webhook-Id": "webhook_event_001",
                    "X-Shopify-Shop-Domain": "loja-teste.myshopify.com",
                    "X-Shopify-Topic": "products/update",
                },
            )

            assert response.status_code == 200
            assert response.json() == {"status": "already_processed"}
