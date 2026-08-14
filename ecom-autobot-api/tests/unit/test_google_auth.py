from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException, status
from httpx import ASGITransport, AsyncClient

from app.core.config.settings import settings
from app.features.auth.domain.models import UserModel
from app.features.auth.schemas import GoogleUserPayload
from app.features.auth.services.google_auth_service import GoogleAuthService
from app.main import app


@pytest.mark.asyncio
async def test_google_login_url_generation():
    """
    Garanta que GET /api/v1/auth/google/login retorne status 200
    e uma URL contendo os parâmetros client_id e redirect_uri.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/auth/google/login")
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        url = data["url"]
        assert "https://accounts.google.com/o/oauth2/v2/auth" in url
        assert f"client_id={settings.GOOGLE_CLIENT_ID}" in url
        assert "redirect_uri=" in url
        assert "response_type=code" in url


@pytest.mark.asyncio
async def test_google_callback_existing_user():
    """
    Simule a resposta do Google para um e-mail já existente no banco.
    Confirme que o callback retorne status 200, o JWT válido e a lista de tenants vinculados.
    """
    mock_google_payload = GoogleUserPayload(
        email="existente.google@ecommerce.com",
        sub="google_sub_1001",
        name="Usuário Existente",
        picture="https://lh3.googleusercontent.com/avatar.png",
        email_verified=True,
    )

    mock_user = UserModel(
        id="usr_existing_uuid_1001",
        email="existente.google@ecommerce.com",
        password_hash="GOOGLE_OAUTH_ACCOUNT",
        name="Usuário Existente",
        role="user",
        tenants=["tenant_existente_a", "tenant_existente_b"],
        is_google_user=True,
    )

    with patch.object(
        GoogleAuthService, "exchange_code_for_user_info", new_callable=AsyncMock
    ) as mock_exchange, patch(
        "app.features.auth.repositories.user_repository.UserRepository.get_by_email",
        new_callable=AsyncMock,
    ) as mock_get_by_email:

        mock_exchange.return_value = mock_google_payload
        mock_get_by_email.return_value = mock_user

        payload = {"code": "google_code_valid_123"}

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/v1/auth/google/callback", json=payload)

            assert response.status_code == 200
            data = response.json()
            assert data["user_id"] == "usr_existing_uuid_1001"
            assert data["email"] == "existente.google@ecommerce.com"
            assert data["access_token"] is not None
            assert data["token_type"] == "bearer"
            assert "tenant_existente_a" in data["tenants"]
            assert data["tenant_id"] == "tenant_existente_a"


@pytest.mark.asyncio
async def test_google_callback_new_user_without_tenant_name():
    """
    Simule um e-mail novo sem enviar tenant_name no payload.
    Verifique se retorna erro HTTP 400 exigindo o nome da organização.
    """
    mock_google_payload = GoogleUserPayload(
        email="novo.sem.tenant@ecommerce.com",
        sub="google_sub_2002",
        name="Novo Usuário Sem Tenant",
        email_verified=True,
    )

    with patch.object(
        GoogleAuthService, "exchange_code_for_user_info", new_callable=AsyncMock
    ) as mock_exchange, patch(
        "app.features.auth.repositories.user_repository.UserRepository.get_by_email",
        new_callable=AsyncMock,
    ) as mock_get_by_email:

        mock_exchange.return_value = mock_google_payload
        mock_get_by_email.return_value = None

        payload = {"code": "google_code_new_user", "tenant_name": None}

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/v1/auth/google/callback", json=payload)

            assert response.status_code == 400
            data = response.json()
            assert "detail" in data
            assert "tenant_name" in data["detail"].lower() or "organização" in data["detail"].lower()


@pytest.mark.asyncio
async def test_google_callback_new_user_with_tenant_name():
    """
    Simule um e-mail novo enviando tenant_name.
    Confirme que o Tenant e o User são criados no PostgreSQL e que o JWT retornado contém o novo tenant_id.
    """
    mock_google_payload = GoogleUserPayload(
        email="novo.com.tenant@ecommerce.com",
        sub="google_sub_3003",
        name="Novo Usuário Com Tenant",
        email_verified=True,
    )

    created_user = UserModel(
        id="usr_created_uuid_3003",
        email="novo.com.tenant@ecommerce.com",
        password_hash="GOOGLE_OAUTH_ACCOUNT",
        name="Novo Usuário Com Tenant",
        role="user",
        tenants=["minha_nova_loja"],
        is_google_user=True,
    )

    with patch.object(
        GoogleAuthService, "exchange_code_for_user_info", new_callable=AsyncMock
    ) as mock_exchange, patch(
        "app.features.auth.repositories.user_repository.UserRepository.get_by_email",
        new_callable=AsyncMock,
    ) as mock_get_by_email, patch(
        "app.features.auth.repositories.user_repository.UserRepository.create_user",
        new_callable=AsyncMock,
    ) as mock_create_user:

        mock_exchange.return_value = mock_google_payload
        mock_get_by_email.return_value = None
        mock_create_user.return_value = created_user

        payload = {
            "code": "google_code_new_user_success",
            "tenant_name": "Minha Nova Loja",
        }

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/v1/auth/google/callback", json=payload)

            assert response.status_code == 200
            data = response.json()
            assert data["user_id"] == "usr_created_uuid_3003"
            assert data["email"] == "novo.com.tenant@ecommerce.com"
            assert "minha_nova_loja" in data["tenants"]
            assert data["tenant_id"] == "minha_nova_loja"
            assert data["access_token"] is not None


@pytest.mark.asyncio
async def test_google_callback_invalid_code():
    """
    Simule erro da API do Google na troca do código.
    Verifique se o backend captura e retorna erro HTTP 400/401 apropriado.
    """
    with patch.object(
        GoogleAuthService, "exchange_code_for_user_info", new_callable=AsyncMock
    ) as mock_exchange:
        from app.features.auth.domain.exceptions import GoogleAuthError
        mock_exchange.side_effect = GoogleAuthError(
            message="Código de autorização do Google inválido ou expirado.",
            status_code=400,
        )

        payload = {"code": "invalid_expired_google_code"}

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/v1/auth/google/callback", json=payload)

            assert response.status_code == 400
            data = response.json()
            assert "detail" in data
            assert "código" in data["detail"].lower() or "inválido" in data["detail"].lower()


@pytest.mark.asyncio
async def test_google_service_exchange_code_http_error():
    """
    Testa diretamente no GoogleAuthService a captura de resposta de erro HTTP (ex: 400) do Google.
    """
    from app.features.auth.domain.exceptions import GoogleAuthError
    service = GoogleAuthService()
    mock_token_resp = MagicMock()
    mock_token_resp.status_code = 400
    mock_token_resp.text = '{"error": "invalid_grant"}'

    with patch(
        "app.features.auth.services.google_auth_service.httpx.AsyncClient.post",
        new_callable=AsyncMock,
    ) as mock_post:
        mock_post.return_value = mock_token_resp
        with pytest.raises(GoogleAuthError) as exc_info:
            await service.exchange_code_for_user_info("bad_code_123")
        assert exc_info.value.status_code == 400
        assert "código" in exc_info.value.message.lower() or "inválido" in exc_info.value.message.lower()
