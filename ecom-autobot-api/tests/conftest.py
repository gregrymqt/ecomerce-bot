import asyncio
import base64
import os
from typing import AsyncGenerator, Dict, Generator
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.settings import settings
from app.core.security.auth import create_access_token


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment() -> Generator[None, None, None]:
    """Configura variáveis de ambiente necessárias para a suíte de testes unitários."""
    test_aes_key = base64.b64encode(os.urandom(32)).decode("utf-8")
    settings.AES_MASTER_KEY = test_aes_key
    settings.JWT_SECRET_KEY = "test_jwt_secret_key_for_unit_testing_only_32bytes!"
    os.environ["AES_MASTER_KEY"] = test_aes_key
    os.environ["JWT_SECRET_KEY"] = settings.JWT_SECRET_KEY
    yield


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Cria uma instância do event loop do asyncio para a sessão de testes."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def mock_async_session() -> AsyncGenerator[AsyncMock, None]:
    """Fixture assíncrona que fornece um mock de AsyncSession do SQLAlchemy."""
    session = AsyncMock(spec=AsyncSession)
    yield session


@pytest.fixture
def test_tenant_id() -> str:
    """Retorna o ID de tenant padrão utilizado no QA de testes."""
    return "tenant_test_qa"


@pytest.fixture
def test_jwt_payload(test_tenant_id: str) -> Dict[str, object]:
    """Payload JWT padrão para testes unitários."""
    return {
        "sub": "usr_qa_test_123",
        "email": "qa@ecomautobot.com",
        "name": "QA Tester",
        "tenants": [test_tenant_id],
        "role": "user",
        "is_admin": False,
    }


@pytest.fixture
def test_jwt_token(test_jwt_payload: Dict[str, object]) -> str:
    """Gera um token JWT assinado válido para os testes."""
    return create_access_token(test_jwt_payload)


@pytest.fixture
def auth_headers(test_tenant_id: str, test_jwt_token: str) -> Dict[str, str]:
    """Cabeçalhos HTTP padrão contendo 'X-Tenant-ID' e 'Authorization' Bearer JWT token."""
    return {
        "Authorization": f"Bearer {test_jwt_token}",
        "X-Tenant-ID": test_tenant_id,
    }
