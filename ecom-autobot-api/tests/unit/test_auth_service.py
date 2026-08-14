from unittest.mock import AsyncMock
import pytest

from app.features.auth.domain import UserModel
from app.features.auth.domain.exceptions import (
    InvalidCredentialsError,
    UserAlreadyExistsError,
)
from app.features.auth.schemas import (
    CreateUserRequest,
    LoginRequest,
    UpdateUserRequest,
)
from app.features.auth.services.auth_service import AuthService


@pytest.mark.asyncio
async def test_register_user_success():
    mock_repo = AsyncMock()
    mock_repo.get_by_email.return_value = None

    created_user = UserModel(
        id="usr_123",
        email="teste@ecommerce.com",
        password_hash="hashed",
        name="Teste Usuário",
        role="user",
        tenants=["ecommerce_demo", "ecommerce_prod"],
    )
    mock_repo.create_user.return_value = created_user

    service = AuthService(user_repo=mock_repo)
    req = CreateUserRequest(email="teste@ecommerce.com", password="password123", name="Teste Usuário")

    res = await service.register_user(req)
    assert res.email == "teste@ecommerce.com"
    assert res.name == "Teste Usuário"
    assert res.role == "user"


@pytest.mark.asyncio
async def test_register_user_already_exists():
    mock_repo = AsyncMock()
    existing = UserModel(
        id="usr_existing",
        email="existente@ecommerce.com",
        password_hash="hashed",
        name="Existente",
        role="user",
        tenants=["ecommerce_demo"],
    )
    mock_repo.get_by_email.return_value = existing

    service = AuthService(user_repo=mock_repo)
    req = CreateUserRequest(email="existente@ecommerce.com", password="password123", name="Existente")

    with pytest.raises(UserAlreadyExistsError) as exc_info:
        await service.register_user(req)

    assert "já está cadastrado" in exc_info.value.message


@pytest.mark.asyncio
async def test_authenticate_user_invalid_credentials():
    mock_repo = AsyncMock()
    mock_repo.get_by_email.return_value = None

    service = AuthService(user_repo=mock_repo)
    login_req = LoginRequest(email="test@ecommerce.com", password="wrongpassword")

    with pytest.raises(InvalidCredentialsError):
        await service.authenticate_user(login_req)
