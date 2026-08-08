from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.features.auth.schemas import AuthTokenResponse, GoogleUserPayload
from app.main import app


@pytest.mark.asyncio
async def test_google_login_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/auth/google/login?state=xyz_state")

        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "https://accounts.google.com/o/oauth2/v2/auth" in data["url"]
        assert "state=xyz_state" in data["url"]


@pytest.mark.asyncio
async def test_google_callback_endpoint_success():
    mock_google_user = GoogleUserPayload(
        email="test_router@gmail.com",
        sub="google_sub_100",
        name="Router Test User",
    )

    mock_auth_token_response = AuthTokenResponse(
        access_token="mock_jwt_token_router",
        token_type="bearer",
        user_id="usr_router_100",
        email="test_router@gmail.com",
        name="Router Test User",
        tenants=["tenant_router_test"],
        tenant_id="tenant_router_test",
    )

    with patch(
        "app.features.auth.services.google_auth_service.GoogleAuthService.exchange_code_for_user_info",
        new_callable=AsyncMock,
    ) as mock_exchange, patch(
        "app.features.auth.services.google_auth_service.GoogleAuthService.authenticate_google_user",
        new_callable=AsyncMock,
    ) as mock_auth:

        mock_exchange.return_value = mock_google_user
        mock_auth.return_value = mock_auth_token_response

        payload = {"code": "valid_google_code_123", "tenant_name": "Tenant Router Test"}

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/v1/auth/google/callback", json=payload)

            assert response.status_code == 200
            data = response.json()
            assert data["access_token"] == "mock_jwt_token_router"
            assert data["user_id"] == "usr_router_100"
            assert data["tenant_id"] == "tenant_router_test"
            assert "access_token" in response.cookies or "set-cookie" in response.headers
