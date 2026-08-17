from typing import Any, Dict, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import get_db
from app.features.mercadopago.domain.entities import MercadoPagoWebhookLog, MercadoPagoWebhookStatus


class MercadoPagoRepository:
    """
    Repositório de persistência assíncrona para logs e auditoria do Mercado Pago (DDD Repository).
    Garante operações atômicas de escrita e consultas por id de recurso externo.
    """

    def __init__(self, session: Optional[AsyncSession] = None):
        self.session = session

    async def _get_session(self) -> Tuple[AsyncSession, bool]:
        if self.session is not None:
            return self.session, False
        gen = get_db()
        session = await anext(gen)
        return session, True

    async def log_webhook_event(
        self,
        event_type: str,
        resource_id: str,
        payload: Dict[str, Any],
        status: MercadoPagoWebhookStatus = MercadoPagoWebhookStatus.RECEIVED,
        tenant_id: str = "default",
        x_request_id: Optional[str] = None,
        error_message: Optional[str] = None,
        session: Optional[AsyncSession] = None,
    ) -> MercadoPagoWebhookLog:
        """Cria e persiste um registro de auditoria de webhook recebido."""
        db_session = session or self.session
        owned = False
        if db_session is None:
            db_session, owned = await self._get_session()

        try:
            log_entry = MercadoPagoWebhookLog(
                tenant_id=tenant_id,
                event_type=event_type,
                resource_id=resource_id,
                status=status,
                x_request_id=x_request_id,
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

    async def get_log_by_resource_id(
        self,
        resource_id: str,
        session: Optional[AsyncSession] = None,
    ) -> Optional[MercadoPagoWebhookLog]:
        """Localiza o log de webhook mais recente pelo identificador do recurso."""
        db_session = session or self.session
        owned = False
        if db_session is None:
            db_session, owned = await self._get_session()

        try:
            stmt = (
                select(MercadoPagoWebhookLog)
                .where(MercadoPagoWebhookLog.resource_id == resource_id)
                .order_by(MercadoPagoWebhookLog.created_at.desc())
            )
            result = await db_session.execute(stmt)
            return result.scalars().first()
        finally:
            if owned:
                await db_session.close()


mercadopago_repository = MercadoPagoRepository()
