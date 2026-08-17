from typing import AsyncGenerator
import logging
import ssl
import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from sqlalchemy.engine import make_url
from app.core.config.settings import settings

logger = logging.getLogger(__name__)

DEFAULT_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/ecommerce_bot_db"
DATABASE_URL = settings.get_transaction_db_url() or DEFAULT_DB_URL

def resolve_ssl_context():
    is_local_db = any(host in DATABASE_URL for host in ["localhost", "127.0.0.1", "postgres", "postgres:5432", "dev-postgres", "prod-postgres"])
    if is_local_db and "supabase" not in DATABASE_URL:
        logger.info("🔓 SSL: Conexão local/Docker detectada. SSL desativado.")
        return None

    # Se um arquivo de certificado SSL foi explicitamente configurado no .env:
    if settings.DB_SSL_CERT_PATH:
        cert_file = settings.DB_SSL_CERT_PATH
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
            logger.info(f"🔒 SSL: Carregando certificado SSL customizado: {resolved_path}")
            context = ssl.create_default_context(cafile=resolved_path)
            context.check_hostname = False
            context.verify_mode = ssl.CERT_REQUIRED
            return context

    if settings.ENVIRONMENT.lower() in ["production", "prod", "staging"] or "supabase" in DATABASE_URL:
        logger.info("🔒 SSL: Ativado modo 'require' para conexão PostgreSQL/Supabase (CAs padrão do sistema).")
        return "require"
    
    return None

connect_args = {}
ssl_ctx = resolve_ssl_context()
if ssl_ctx is not None:
    connect_args["ssl"] = ssl_ctx

# Em pgBouncer / Supabase Transaction Pooler (porta 6543), desabilita prepared statements no asyncpg
if ":6543" in DATABASE_URL or "pooler.supabase.com" in DATABASE_URL or settings.POSTGRES_URI_TRANSACTION:
    logger.info("⚙️ Supabase/pgBouncer Pooler detectado (porta 6543 / pooler). Prepared statements desabilitados.")
    connect_args["statement_cache_size"] = 0
    connect_args["prepared_statement_cache_size"] = 0

try:
    sanitized_url = make_url(DATABASE_URL).render_as_string(hide_password=True)
except Exception:
    sanitized_url = "postgresql+asyncpg://***"

logger.info(f"🔌 Inicializando engine do banco de dados em: {sanitized_url}")

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


async def check_db_connection() -> bool:
    """
    Testa e valida a conexão ativa com o PostgreSQL / Supabase no startup da aplicação.
    """
    try:
        logger.info("🔄 Testando conexão com o banco de dados PostgreSQL/Supabase...")
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT version();"))
            db_version = result.scalar()
            logger.info(f"✅ Conexão com o PostgreSQL/Supabase OK! Versão do banco: {db_version[:70]}...")
            return True
    except Exception as err:
        err_msg = str(err)
        if "tenant/user" in err_msg and "not found" in err_msg:
            logger.error(
                "❌ Falha no Supabase: Projeto não encontrado ou PAUSADO no painel do Supabase. "
                "Acesse https://supabase.com/dashboard para verificar se o projeto está ativo "
                "ou se as credenciais no .env conferem."
            )
        elif "allow_list" in err_msg or "EADDRNOTALLOWED" in err_msg:
            logger.error(
                "❌ Falha no Supabase (Restrição de IP): Seu IP atual não está liberado no Supabase. "
                "Acesse: Supabase Dashboard -> Project Settings -> Network Restrictions "
                "e adicione seu IP atual ou remova a restrição de IP."
            )
        else:
            logger.error(f"❌ Falha crítica ao conectar no PostgreSQL/Supabase ({sanitized_url}): {err}")
        raise err


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
        try:
            yield session
        except GeneratorExit:
            pass