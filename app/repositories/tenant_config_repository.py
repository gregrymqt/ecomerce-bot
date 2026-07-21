import logging
from sqlalchemy import select
from app.config.database import AsyncSessionLocal
from app.models.database_models import TenantConfigModel


class TenantConfigRepository:
    def __init__(self, session: AsyncSessionLocal = None):
        self.session = session

    async def _get_session(self):
        if self.session is not None:
            return self.session, False
        session = AsyncSessionLocal()
        return session, True

    async def get(self, tenant_id: str) -> TenantConfigModel | None:
        session, owned = await self._get_session()
        try:
            stmt = select(TenantConfigModel).where(TenantConfigModel.tenant_id == tenant_id)
            result = await session.execute(stmt)
            return result.scalar_one_or_none()
        finally:
            if owned:
                await session.close()

    async def upsert(self, tenant_id: str, encrypted_keys: dict) -> None:
        session, owned = await self._get_session()
        try:
            existing = await session.get(TenantConfigModel, tenant_id)
            if existing is None:
                session.add(TenantConfigModel(tenant_id=tenant_id, encrypted_keys=encrypted_keys))
            else:
                existing.encrypted_keys = encrypted_keys
            await session.commit()
        except Exception:
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()
