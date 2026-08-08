import logging
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import AsyncSessionLocal
from app.features.auth.domain.enterprise_lead_model import EnterpriseLeadModel

logger = logging.getLogger(__name__)


class EnterpriseLeadRepository:
    """
    Repositório assíncrono para persistência e consulta de leads do SSO Enterprise no PostgreSQL.
    """

    def __init__(self, session: Optional[AsyncSession] = None):
        self.session = session

    async def _get_session(self) -> tuple[AsyncSession, bool]:
        if self.session is not None:
            return self.session, False
        session = AsyncSessionLocal()
        return session, True

    async def create_lead(self, lead: EnterpriseLeadModel) -> EnterpriseLeadModel:
        session, owned = await self._get_session()
        try:
            session.add(lead)
            await session.commit()
            await session.refresh(lead)
            return lead
        except Exception as e:
            if owned:
                await session.rollback()
            logger.error(f"Erro ao cadastrar lead Enterprise para {lead.email}: {e}")
            raise
        finally:
            if owned:
                await session.close()

    async def get_by_email(self, email: str) -> Optional[EnterpriseLeadModel]:
        session, owned = await self._get_session()
        try:
            stmt = select(EnterpriseLeadModel).where(EnterpriseLeadModel.email == email.lower())
            result = await session.execute(stmt)
            return result.scalar_one_or_none()
        finally:
            if owned:
                await session.close()
