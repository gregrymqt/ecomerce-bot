import logging
from sqlalchemy import select

from app.core.config.database import AsyncSessionLocal, engine, Base
from app.features.auth.models import RoleModel

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
