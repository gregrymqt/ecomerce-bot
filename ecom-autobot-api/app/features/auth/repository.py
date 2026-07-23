import logging
from typing import Optional, Dict, Union
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import AsyncSessionLocal
from app.features.auth.models import UserModel

logger = logging.getLogger(__name__)

UserUpdateValue = Union[str, bool, list, int, float, None]

class UserRepository:
    def __init__(self, session: Optional[AsyncSession] = None):
        self.session = session

    async def _get_session(self) -> tuple[AsyncSession, bool]:
        if self.session is not None:
            return self.session, False
        session = AsyncSessionLocal()
        return session, True

    async def get_by_email(self, email: str) -> Optional[UserModel]:
        session, owned = await self._get_session()
        try:
            stmt = select(UserModel).where(UserModel.email == email.lower())
            result = await session.execute(stmt)
            return result.scalar_one_or_none()
        finally:
            if owned:
                await session.close()

    async def get_by_id(self, user_id: str) -> Optional[UserModel]:
        session, owned = await self._get_session()
        try:
            stmt = select(UserModel).where(UserModel.id == user_id)
            result = await session.execute(stmt)
            return result.scalar_one_or_none()
        finally:
            if owned:
                await session.close()

    async def create_user(self, user: UserModel) -> UserModel:
        session, owned = await self._get_session()
        try:
            session.add(user)
            await session.commit()
            await session.refresh(user)
            return user
        except Exception as e:
            if owned:
                await session.rollback()
            logger.error(f"Erro ao criar usuário {user.email}: {e}")
            raise
        finally:
            if owned:
                await session.close()

    async def update_user(self, user_id: str, update_fields: Dict[str, UserUpdateValue]) -> Optional[UserModel]:
        session, owned = await self._get_session()
        try:
            user = await session.get(UserModel, user_id)
            if not user:
                return None

            for key, value in update_fields.items():
                if value is not None and hasattr(user, key):
                    setattr(user, key, value)

            await session.commit()
            await session.refresh(user)
            return user
        except Exception as e:
            if owned:
                await session.rollback()
            logger.error(f"Erro ao atualizar usuário {user_id}: {e}")
            raise
        finally:
            if owned:
                await session.close()
