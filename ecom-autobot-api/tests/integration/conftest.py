import os
from typing import AsyncGenerator, Tuple
from unittest.mock import AsyncMock

import aio_pika
import pytest
import redis.asyncio as redis
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker

from app.core.config.database import Base
from app.core.config.settings import settings
from app.features.products.domain.models import TenantConfigModel


# Compilação do tipo JSONB do PostgreSQL para SQLite em ambiente de teste
@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Fixture assíncrona que abre e limpa uma AsyncSession no banco de testes."""
    db_url = os.environ.get("DATABASE_URL") or "sqlite+aiosqlite:///:memory:"
    engine = create_async_engine(db_url, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session_factory = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session_factory() as session:
        yield session
        # Cleanup dos dados criados durante os testes
        for table in reversed(Base.metadata.sorted_tables):
            try:
                await session.execute(text(f"TRUNCATE TABLE {table.name} CASCADE;"))
                await session.commit()
            except Exception:
                await session.rollback()
                try:
                    await session.execute(text(f"DELETE FROM {table.name};"))
                    await session.commit()
                except Exception:
                    await session.rollback()

    await engine.dispose()


@pytest.fixture
async def async_db_session(db_session: AsyncSession) -> AsyncGenerator[AsyncSession, None]:
    """Alias fixture para compatibilidade retroativa com testes existentes."""
    yield db_session


@pytest.fixture
async def rabbitmq_channel() -> AsyncGenerator[aio_pika.abc.AbstractChannel, None]:
    """Conecta ao RabbitMQ via aio-pika, declara as filas de teste e realiza purge ao finalizar."""
    rabbitmq_url = os.environ.get("RABBITMQ_URL") or getattr(settings, "RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
    try:
        connection = await aio_pika.connect_robust(rabbitmq_url, timeout=5)
        channel = await connection.channel()

        prod_queue = await channel.declare_queue("ecommerce_prod_test", durable=True)
        demo_queue = await channel.declare_queue("ecommerce_demo_test", durable=True)

        yield channel

        await prod_queue.purge()
        await demo_queue.purge()
        await connection.close()
    except Exception:
        # Mock fallback resiliente se o serviço RabbitMQ não estiver rodando localmente
        mock_channel = AsyncMock(spec=aio_pika.abc.AbstractChannel)
        mock_queue = AsyncMock()
        mock_channel.declare_queue.return_value = mock_queue
        yield mock_channel


@pytest.fixture
async def redis_client() -> AsyncGenerator[redis.Redis, None]:
    """Conecta ao Redis via redis.asyncio.Redis e executa flushDB ao finalizar."""
    redis_url = os.environ.get("REDIS_URL") or getattr(settings, "REDIS_URL", "redis://localhost:6379/0")
    try:
        client = redis.Redis.from_url(redis_url, decode_responses=True)
        await client.ping()
        yield client
        await client.flushdb()
        await client.aclose()
    except Exception:
        # Mock fallback se o serviço Redis não estiver rodando localmente
        mock_redis = AsyncMock()
        yield mock_redis


@pytest.fixture
async def setup_tenants(db_session: AsyncSession) -> Tuple[str, str]:
    """Cria dois tenants distintos (tenant_alpha e tenant_beta) na tabela de configurações/tenants."""
    tenant_alpha_id = "tenant_alpha"
    tenant_beta_id = "tenant_beta"

    config_alpha = TenantConfigModel(
        tenant_id=tenant_alpha_id,
        encrypted_keys={"deepseek_api_key": "enc_alpha_key"},
        ai_settings={"tone": "agressivo", "target_audience": "dropshippers", "margin_percentage": 25.5},
    )
    config_beta = TenantConfigModel(
        tenant_id=tenant_beta_id,
        encrypted_keys={"groq_api_key": "enc_beta_key"},
        ai_settings={"tone": "profissional", "target_audience": "varejo"},
    )

    db_session.add(config_alpha)
    db_session.add(config_beta)
    await db_session.commit()

    return tenant_alpha_id, tenant_beta_id

