from typing import AsyncGenerator
import logging
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from sqlalchemy import text
from app.core.config.settings import settings

logger = logging.getLogger(__name__)

import ssl
import os

DEFAULT_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/ecommerce_bot_db"
DATABASE_URL = settings.get_transaction_db_url() or DEFAULT_DB_URL

def resolve_ssl_context():
    # Em desenvolvimento local conectando ao Postgres do Docker (localhost/127.0.0.1), desativa SSL
    is_dev = settings.ENVIRONMENT.lower() in ["development", "dev"]
    is_local_db = any(host in DATABASE_URL for host in ["localhost", "127.0.0.1", "postgres:5432", "dev-postgres"])
    if is_dev and is_local_db and "supabase" not in DATABASE_URL:
        return None

    cert_file = settings.DB_SSL_CERT_PATH or "prod-ca-2021.crt"
    candidates = [
        cert_file,
        os.path.join(os.getcwd(), cert_file),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", cert_file)),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", cert_file))
    ]
    resolved_path = None
    for cand in candidates:
        if cand and os.path.exists(cand) and os.path.isfile(cand):
            resolved_path = cand
            break

    if resolved_path:
        logger.info(f"🔒 Carregando certificado SSL do PostgreSQL: {resolved_path}")
        context = ssl.create_default_context(cafile=resolved_path)
        context.check_hostname = False
        context.verify_mode = ssl.CERT_REQUIRED
        return context

    if settings.ENVIRONMENT.lower() in ["production", "prod", "staging"] or "supabase.com" in DATABASE_URL:
        return "require"
    return None

connect_args = {}
ssl_ctx = resolve_ssl_context()
if ssl_ctx is not None:
    connect_args["ssl"] = ssl_ctx

# Em pgBouncer / Supabase Transaction Pooler (porta 6543), desabilita prepared statements no asyncpg
if ":6543" in DATABASE_URL or "pooler.supabase.com" in DATABASE_URL or settings.POSTGRES_URI_TRANSACTION:
    connect_args["statement_cache_size"] = 0
    connect_args["prepared_statement_cache_size"] = 0

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=300,
    pool_pre_ping=True,
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