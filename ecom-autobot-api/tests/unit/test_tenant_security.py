from typing import AsyncGenerator, Dict
from unittest.mock import patch

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from httpx import ASGITransport, AsyncClient

from app.core.security.auth import (
    AuthenticatedUser,
    get_current_tenant_user,
    sanitize_tenant_id,
)
from app.features.auth.router import router as auth_router


@pytest.fixture
def test_app() -> FastAPI:
    """Cria uma instância isolada do FastAPI contendo as rotas de auth para testes de integração de tenant."""
    app = FastAPI()
    app.include_router(auth_router, prefix="/api/v1")
    return app


@pytest.fixture
async def async_client(test_app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    """Cliente HTTP assíncrono para os testes de endpoints protegidos."""
    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as client:
        yield client


def test_sanitize_tenant_id_valid() -> None:
    """Valida a sanitização correta do ID de tenant."""
    assert sanitize_tenant_id("tenant_test_qa") == "tenant_test_qa"
    assert sanitize_tenant_id("  tenant-123_abc  ") == "tenant-123_abc"


def test_sanitize_tenant_id_missing_raises_400() -> None:
    """Garante erro 400 ao omitir ou passar tenant em branco."""
    with pytest.raises(HTTPException) as exc_info:
        sanitize_tenant_id("")
    assert exc_info.value.status_code == 400

    with pytest.raises(HTTPException) as exc_info:
        sanitize_tenant_id("   ")
    assert exc_info.value.status_code == 400


def test_sanitize_tenant_id_invalid_format_raises_400() -> None:
    """Garante erro 400 ao enviar caracteres não autorizados no X-Tenant-ID."""
    invalid_tenants = ["tenant@123!", "tenant/../admin", "tenant;DROP TABLE", "tenant space"]
    for invalid in invalid_tenants:
        with pytest.raises(HTTPException) as exc_info:
            sanitize_tenant_id(invalid)
        assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_get_current_tenant_user_success(test_tenant_id: str, test_jwt_token: str) -> None:
    """Valida retorno com sucesso da dependência de tenant quando token e tenant são válidos."""
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=test_jwt_token)

    with patch("app.core.security.auth.is_token_blacklisted", return_value=False):
        user = await get_current_tenant_user(x_tenant_id=test_tenant_id, credentials=credentials)

    assert isinstance(user, AuthenticatedUser)
    assert user.user_id == "usr_qa_test_123"
    assert test_tenant_id in user.tenants


@pytest.mark.asyncio
async def test_get_current_tenant_user_forbidden_tenant_raises_403() -> None:
    """Caso 2 (Tenant Não Autorizado): Simular payload JWT contendo tenants=['tenant_A'], enviando X-Tenant-ID: tenant_B. Assertar HTTPException status 403."""
    from app.core.security.auth import create_access_token
    token_tenant_a = create_access_token({
        "sub": "usr_tenant_a",
        "email": "user_a@test.com",
        "tenants": ["tenant_A"],
        "role": "user",
    })
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token_tenant_a)

    with patch("app.core.security.auth.is_token_blacklisted", return_value=False):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_tenant_user(x_tenant_id="tenant_B", credentials=credentials)

    assert exc_info.value.status_code == 403
    assert "Acesso negado" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_tenant_user_blacklisted_token_raises_401(
    test_tenant_id: str, test_jwt_token: str
) -> None:
    """Garante HTTP 401 quando o token está revogado na blacklist."""
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=test_jwt_token)

    with patch("app.core.security.auth.is_token_blacklisted", return_value=True):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_tenant_user(x_tenant_id=test_tenant_id, credentials=credentials)

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoint_without_x_tenant_id_returns_400_or_401_or_422(
    async_client: AsyncClient, test_jwt_token: str
) -> None:
    """Garante que requisições a endpoints protegidos sem o cabeçalho 'X-Tenant-ID' retornem status 400 ou 401 (ou 422 da validação)."""
    headers = {"Authorization": f"Bearer {test_jwt_token}"}
    response = await async_client.get("/api/v1/auth/me", headers=headers)

    assert response.status_code in {400, 401, 422}


@pytest.mark.asyncio
async def test_protected_endpoint_without_auth_header_returns_401_or_403(
    async_client: AsyncClient, test_tenant_id: str
) -> None:
    """Garante que requisições a endpoints protegidos sem cabeçalho de autorização falhem com 401 ou 403."""
    headers = {"X-Tenant-ID": test_tenant_id}
    response = await async_client.get("/api/v1/auth/me", headers=headers)

    assert response.status_code in {401, 403}


@pytest.mark.asyncio
async def test_protected_endpoint_success(
    async_client: AsyncClient, auth_headers: Dict[str, str]
) -> None:
    """Garante sucesso HTTP 200 em endpoint protegido com headers válidos."""
    with patch("app.core.security.auth.is_token_blacklisted", return_value=False):
        response = await async_client.get("/api/v1/auth/me", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["sub"] == "usr_qa_test_123"
