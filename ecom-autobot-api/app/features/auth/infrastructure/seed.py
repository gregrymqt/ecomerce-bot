import logging
from sqlalchemy import select

from app.core.config.database import AsyncSessionLocal, Base, engine
from app.core.config.settings import settings
from app.features.auth.domain.models import RoleModel, UserModel

logger = logging.getLogger(__name__)

INITIAL_ROLES = [
    {"name": "user", "description": "Usuário padrão do sistema"},
    {"name": "ecommerce", "description": "Lojista / Dono de e-commerce"},
    {"name": "admin", "description": "Administrador / Programador do sistema"},
]


async def seed_initial_roles() -> None:
    """
    Inicializa a estrutura de tabelas do banco de dados e insere automaticamente
    as 3 roles de acesso padrão ('user', 'ecommerce', 'admin') caso ainda não existam.
    """
    try:
        # Garante a criação de todas as tabelas mapeadas no SQLAlchemy
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with AsyncSessionLocal() as session:
            roles_added = 0
            for role_data in INITIAL_ROLES:
                stmt = select(RoleModel).where(RoleModel.name == role_data["name"])
                result = await session.execute(stmt)
                existing = result.scalar_one_or_none()
                if not existing:
                    new_role = RoleModel(
                        name=role_data["name"],
                        description=role_data["description"],
                    )
                    session.add(new_role)
                    roles_added += 1

            if roles_added > 0:
                await session.commit()
                logger.info(
                    f"[DB Seed] {roles_added} roles padrão ('user', 'ecommerce', 'admin') foram inseridas no banco de dados."
                )
            else:
                logger.info("[DB Seed] Roles padrão ('user', 'ecommerce', 'admin') já estão inicializadas.")

    except Exception as err:
        logger.warning(
            f"[DB Seed] Não foi possível verificar/popular as roles no banco de dados: {err}"
        )


async def seed_admin_users() -> None:
    """
    Verifica a lista de e-mails de administradores configurada no .env (ADMIN_EMAILS)
    e atualiza a role dos usuários cadastrados no banco para 'admin'.
    """
    admin_emails = settings.get_admin_emails_list()
    if not admin_emails:
        return

    try:
        async with AsyncSessionLocal() as session:
            promoted_count = 0
            for email in admin_emails:
                stmt = select(UserModel).where(UserModel.email == email)
                result = await session.execute(stmt)
                user = result.scalar_one_or_none()
                if user and user.role != "admin":
                    user.role = "admin"
                    promoted_count += 1
                    logger.info(f"[DB Seed] Usuário '{email}' promovido para a role 'admin'.")

            if promoted_count > 0:
                await session.commit()
                logger.info(f"[DB Seed] {promoted_count} usuário(s) promovido(s) para 'admin' com sucesso.")
    except Exception as err:
        logger.warning(
            f"[DB Seed] Não foi possível sincronizar usuários admins do .env no banco de dados: {err}"
        )
