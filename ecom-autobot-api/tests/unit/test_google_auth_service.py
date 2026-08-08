from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.features.auth.domain.models import UserModel
from app.features.auth.schemas import GoogleUserPayload
from app.features.auth.services.google_auth_service import GoogleAuthService


def test_get_google_auth_url():
    service = GoogleAuthService()
    url = service.get_google_auth_url(state="test_state_123")
    assert "https://accounts.google.com/o/oauth2/v2/auth" in url
    assert "response_type=code" in url
    assert "state=test_state_123" in url
    assert "scope=openid+email+profile" in url or "scope=openid" in url


@pytest.mark.asyncio
async def test_exchange_code_for_user_info_success():
    service = GoogleAuthService()

    mock_token_resp = MagicMock()
    mock_token_resp.status_code = 200
    mock_token_resp.json.return_value = {"access_token": "mock_access_token_123"}

    mock_userinfo_resp = MagicMock()
    mock_userinfo_resp.status_code = 200
    mock_userinfo_resp.json.return_value = {
        "email": "user@gmail.com",
        "sub": "1234567890",
        "name": "Maria Silva",
        "picture": "https://example.com/avatar.jpg",
        "email_verified": True,
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, patch(
        "httpx.AsyncClient.get", new_callable=AsyncMock
    ) as mock_get:
        mock_post.return_value = mock_token_resp
        mock_get.return_value = mock_userinfo_resp

        payload = await service.exchange_code_for_user_info("valid_code")
        assert payload.email == "user@gmail.com"
        assert payload.sub == "1234567890"
        assert payload.name == "Maria Silva"
        assert payload.picture == "https://example.com/avatar.jpg"
        assert payload.email_verified is True


@pytest.mark.asyncio
async def test_exchange_code_for_user_info_invalid_code():
    service = GoogleAuthService()

    mock_token_resp = MagicMock()
    mock_token_resp.status_code = 400
    mock_token_resp.text = "invalid_grant"

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_token_resp
        with pytest.raises(HTTPException) as exc_info:
            await service.exchange_code_for_user_info("bad_code")
        assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_authenticate_google_user_existing_user():
    mock_user_repo = AsyncMock()
    existing_user = UserModel(
        id="usr_existing_123",
        email="existente@gmail.com",
        password_hash="GOOGLE_OAUTH_ACCOUNT",
        name="Usuário Existente",
        role="user",
        tenants=["tenant_existente"],
    )
    mock_user_repo.get_by_email.return_value = existing_user

    service = GoogleAuthService(user_repo=mock_user_repo)
    google_user = GoogleUserPayload(
        email="existente@gmail.com",
        sub="google_sub_1",
        name="Usuário Existente",
    )

    resp = await service.authenticate_google_user(db=None, google_user=google_user)
    assert resp.user_id == "usr_existing_123"
    assert resp.email == "existente@gmail.com"
    assert resp.tenants == ["tenant_existente"]
    assert resp.access_token is not None


@pytest.mark.asyncio
async def test_authenticate_google_user_new_user_requires_tenant_name():
    mock_user_repo = AsyncMock()
    mock_user_repo.get_by_email.return_value = None

    service = GoogleAuthService(user_repo=mock_user_repo)
    google_user = GoogleUserPayload(
        email="novo@gmail.com",
        sub="google_sub_2",
        name="Novo Usuário",
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.authenticate_google_user(db=None, google_user=google_user, tenant_name=None)

    assert exc_info.value.status_code == 400
    assert "tenant_name" in exc_info.value.detail.lower() or "organização" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_authenticate_google_user_new_user_with_tenant_name():
    mock_user_repo = AsyncMock()
    mock_user_repo.get_by_email.return_value = None

    created_user = UserModel(
        id="usr_new_999",
        email="novo@gmail.com",
        password_hash="GOOGLE_OAUTH_ACCOUNT",
        name="Novo Usuário",
        role="user",
        tenants=["minha_loja_online"],
        is_google_user=True,
    )
    mock_user_repo.create_user.return_value = created_user

    service = GoogleAuthService(user_repo=mock_user_repo)
    google_user = GoogleUserPayload(
        email="novo@gmail.com",
        sub="google_sub_2",
        name="Novo Usuário",
    )

    resp = await service.authenticate_google_user(db=None, google_user=google_user, tenant_name="Minha Loja Online")

    assert resp.user_id == "usr_new_999"
    assert resp.email == "novo@gmail.com"
    assert resp.tenants == ["minha_loja_online"]
    assert resp.tenant_id == "minha_loja_online"
    assert resp.access_token is not None
