from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import get_db
from app.features.emails.domain.entities import EmailLog, EmailStatus


class EmailRepository:
    """
    Repositório de persistência assíncrona para logs e auditoria de e-mails (DDD Repository).
    Garante operações atômicas de inserção em lote e consultas por identificador externo do Resend.
    """

    def __init__(self, session: Optional[AsyncSession] = None):
        self.session = session

    async def _get_session(self) -> Tuple[AsyncSession, bool]:
        if self.session is not None:
            return self.session, False
        gen = get_db()
        session = await anext(gen)
        return session, True

    async def create_batch(
        self,
        logs: List[EmailLog],
        session: Optional[AsyncSession] = None,
    ) -> List[EmailLog]:
        """Persiste um lote de entidades EmailLog em uma única operação no banco."""
        db_session = session or self.session
        owned = False
        if db_session is None:
            db_session, owned = await self._get_session()

        try:
            db_session.add_all(logs)
            await db_session.flush()
            if owned:
                await db_session.commit()
            return logs
        except Exception:
            if owned:
                await db_session.rollback()
            raise
        finally:
            if owned:
                await db_session.close()

    async def get_by_resend_id(
        self,
        resend_id: str,
        session: Optional[AsyncSession] = None,
    ) -> Optional[EmailLog]:
        """Localiza o registro de e-mail através do UUID atribuído pelo Resend."""
        db_session = session or self.session
        owned = False
        if db_session is None:
            db_session, owned = await self._get_session()

        try:
            stmt = select(EmailLog).where(EmailLog.resend_id == resend_id)
            result = await db_session.execute(stmt)
            return result.scalar_one_or_none()
        finally:
            if owned:
                await db_session.close()

    async def update_status_by_resend_id(
        self,
        resend_id: str,
        new_status: EmailStatus,
        metadata_update: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
        session: Optional[AsyncSession] = None,
    ) -> Optional[EmailLog]:
        """Atualiza o status de entrega do e-mail a partir de eventos de Webhook."""
        db_session = session or self.session
        owned = False
        if db_session is None:
            db_session, owned = await self._get_session()

        try:
            email_log = await self.get_by_resend_id(resend_id, session=db_session)
            if not email_log:
                return None

            email_log.status = new_status
            if error_message:
                email_log.error_message = error_message

            if metadata_update:
                current_meta = dict(email_log.metadata_info or {})
                current_meta.update(metadata_update)
                email_log.metadata_info = current_meta

            await db_session.flush()
            if owned:
                await db_session.commit()
            return email_log
        except Exception:
            if owned:
                await db_session.rollback()
            raise
        finally:
            if owned:
                await db_session.close()


email_repository = EmailRepository()