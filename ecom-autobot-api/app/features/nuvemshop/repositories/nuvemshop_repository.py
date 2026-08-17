import logging
from typing import Any, Dict, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import get_db
from app.features.nuvemshop.domain.entities import NuvemshopCredentials, NuvemshopWebhookLog, NuvemshopWebhookStatus
from app.features.products.repositories.tenant_config_repository import TenantConfigRepository

logger = logging.getLogger(__name__)


class NuvemshopRepository:
    """
    Repositório de dados para recuperar credenciais, estado da integração e logs de auditoria da Nuvemshop (DDD Repository).
    """

    def __init__(
        self,
        tenant_repo: Optional[TenantConfigRepository] = None,
        session: Optional[AsyncSession] = None,
    ):
        self.session = session
        self.tenant_repo = tenant_repo or TenantConfigRepository(session=session)

    async def _get_session(self) -> Tuple[AsyncSession, bool]:
        if self.session is not None:
            return self.session, False
        gen = get_db()
        session = await anext(gen)
        return session, True

    async def get_credentials(self, tenant_id: str) -> Optional[NuvemshopCredentials]:
        """Recupera e descriptografa as credenciais da Nuvemshop para o tenant especificado."""
        creds = await self.tenant_repo.get_nuvemshop_credentials(tenant_id)
        if not creds:
            return None
        store_id, access_token, app_email = creds
        return NuvemshopCredentials(store_id=store_id, access_token=access_token, app_email=app_email)

    async def get_tenant_id_by_store_id(self, store_id: str) -> Optional[str]:
        """Recupera o tenant_id proprietário do store_id da Nuvemshop."""
        return await self.tenant_repo.get_tenant_id_by_nuvemshop_store_id(store_id)

    async def deactivate_credentials(self, tenant_id: str) -> bool:
        """Inativa as credenciais da Nuvemshop para o tenant especificado."""
        return await self.tenant_repo.deactivate_nuvemshop_integration(tenant_id)

    async def log_webhook_event(
        self,
        store_id: int,
        event_id: str,
        event: str,
        payload: Dict[str, Any],
        resource_id: Optional[int] = None,
        status: NuvemshopWebhookStatus = NuvemshopWebhookStatus.RECEIVED,
        error_message: Optional[str] = None,
        session: Optional[AsyncSession] = None,
    ) -> NuvemshopWebhookLog:
        """Cria e persiste um registro de auditoria de webhook recebido da Nuvemshop."""
        db_session = session or self.session
        owned = False
        if db_session is None:
            db_session, owned = await self._get_session()

        try:
            log_entry = NuvemshopWebhookLog(
                store_id=store_id,
                event_id=event_id,
                event=event,
                resource_id=resource_id,
                status=status,
                payload=payload,
                error_message=error_message,
            )
            db_session.add(log_entry)
            await db_session.flush()
            if owned:
                await db_session.commit()
            return log_entry
        except Exception:
            if owned:
                await db_session.rollback()
            raise
        finally:
            if owned:
                await db_session.close()

    async def get_webhook_log_by_event_id(
        self,
        event_id: str,
        session: Optional[AsyncSession] = None,
    ) -> Optional[NuvemshopWebhookLog]:
        """Localiza o log de webhook pelo event_id composto."""
        db_session = session or self.session
        owned = False
        if db_session is None:
            db_session, owned = await self._get_session()

        try:
            stmt = select(NuvemshopWebhookLog).where(NuvemshopWebhookLog.event_id == event_id)
            result = await db_session.execute(stmt)
            return result.scalar_one_or_none()
        finally:
            if owned:
                await db_session.close()


nuvemshop_repository = NuvemshopRepository()
