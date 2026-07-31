from typing import AsyncGenerator
import logging
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from sqlalchemy import text
from app.core.config.settings import settings

logger = logging.getLogger(__name__)

DEFAULT_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/ecommerce_bot_db"
DATABASE_URL = settings.POSTGRES_URI if settings.POSTGRES_URI else DEFAULT_DB_URL

if DATABASE_URL and DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# Em ambiente de produção / Supabase, força SSL Criptografado
connect_args = {}
if settings.ENVIRONMENT.lower() in ["production", "prod", "staging"]:
    connect_args["ssl"] = "require"

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    poolclass=NullPool,
    connect_args=connect_args
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()


async def set_db_tenant_context(session: AsyncSession, tenant_id: str) -> None:
    """
    Define a variável de sessão 'app.current_tenant' na conexão ativa do PostgreSQL.
    Isso ativa o filtro nativo das políticas de Row Level Security (RLS).
    """
    if tenant_id:
        # Sanitização básica para evitar SQL Injection em variáveis de sessão
        clean_tenant = tenant_id.strip().replace("'", "")
        await session.execute(text(f"SET LOCAL app.current_tenant = '{clean_tenant}';"))


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Injetor de dependência para rotas FastAPI."""
    async with AsyncSessionLocal() as session:
        yield session