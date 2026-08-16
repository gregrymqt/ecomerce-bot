from fastapi import Depends
from app.core.config.database import get_db
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.emails.domain.entities import EmailLog, EmailStatus


class EmailRepository:
    """
    Repositório de persistência assíncrona para logs e auditoria de e-mails (DDD Repository).
    Garante operações atômicas de inserção em lote e consultas por identificador externo do Resend.
    """

    def __init__(self, session: Optional[AsyncSession] = None):
        self._session = session

    async def create_batch(
        self,
        logs: List[EmailLog],
        session: Optional[AsyncSession] = None,
    ) -> List[EmailLog]:
        """Persiste um lote de entidades EmailLog em uma única operação no banco."""
        db_session = session or self._session
        db_session.add_all(logs)
        await db_session.flush()
        return logs

    async def get_by_resend_id(
        self,
        session: AsyncSession,
        resend_id: str
    ) -> Optional[EmailLog]:
        """Localiza o registro de e-mail através do UUID atribuído pelo Resend."""
        stmt = select(EmailLog).where(EmailLog.resend_id == resend_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_status_by_resend_id(
        self,
        session: AsyncSession,
        resend_id: str,
        new_status: EmailStatus,
        metadata_update: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
    ) -> Optional[EmailLog]:
        """Atualiza o status de entrega do e-mail a partir de eventos de Webhook."""
        email_log = await self.get_by_resend_id(session, resend_id)
        if not email_log:
            return None

        email_log.status = new_status
        if error_message:
            email_log.error_message = error_message

        if metadata_update:
            current_meta = dict(email_log.metadata_info or {})
            current_meta.update(metadata_update)
            email_log.metadata_info = current_meta

        await session.flush()
        return email_log


email_repository = EmailRepository()