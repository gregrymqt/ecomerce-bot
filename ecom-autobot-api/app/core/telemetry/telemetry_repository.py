from datetime import datetime, timezone, timedelta
import logging
import uuid
from typing import Dict, Optional, Tuple, Union

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import get_db
from app.core.telemetry.models import RobotActivityModel, TokenTelemetryModel

logger = logging.getLogger(__name__)


class TelemetryRepository:
    """
    Repositório assíncrono para consultas analíticas de métricas, telemetria
    e histórico de atividades do sistema, com isolamento estrito por tenant_id.
    """

    def __init__(self, session: Optional[AsyncSession] = None):
        self.session = session

    async def _get_session(self) -> Tuple[AsyncSession, bool]:
        if self.session is not None:
            return self.session, False
        gen = get_db()
        session = await anext(gen)
        return session, True

    async def log_activity(
        self,
        tenant_id: str,
        worker_type: str,
        status: str,
        details: Optional[Dict[str, Union[str, int, float, bool]]] = None,
        duration_ms: Optional[int] = None,
    ) -> RobotActivityModel:
        """
        Registra um log de execução de robô na tabela robot_activities.
        """
        session, owned = await self._get_session()
        try:
            activity = RobotActivityModel(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                worker_type=worker_type,
                status=status,
                details=details,
                duration_ms=duration_ms,
                created_at=datetime.now(timezone.utc),
            )
            session.add(activity)
            await session.commit()
            await session.refresh(activity)
            return activity
        except Exception as e:
            logger.error(f"Erro ao registrar atividade do robô para o tenant {tenant_id}: {e}")
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()

    async def record_token_usage(
        self,
        tenant_id: str,
        provider: str,
        prompt_tokens: int,
        completion_tokens: int,
    ) -> TokenTelemetryModel:
        """
        Persiste o consumo de tokens de uma chamada LLM na tabela token_telemetry.
        """
        session, owned = await self._get_session()
        try:
            total_tokens = prompt_tokens + completion_tokens
            token_record = TokenTelemetryModel(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                provider=provider.lower().strip(),
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                created_at=datetime.now(timezone.utc),
            )
            session.add(token_record)
            await session.commit()
            await session.refresh(token_record)
            return token_record
        except Exception as e:
            logger.error(f"Erro ao registrar consumo de tokens para o tenant {tenant_id}: {e}")
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()


telemetry_repository = TelemetryRepository()

