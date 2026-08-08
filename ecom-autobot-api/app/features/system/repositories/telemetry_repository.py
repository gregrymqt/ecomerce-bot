from datetime import datetime, timezone, timedelta
import logging
import uuid
from typing import Dict, List, Optional, Tuple, Union

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import AsyncSessionLocal
from app.features.products.domain.models import ProductModel
from app.features.system.domain.models import RobotActivityModel, TokenTelemetryModel
from app.features.system.schemas.system_schemas import (
    ProductStatusSummary,
    TokenTelemetrySchema,
)

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
        session = AsyncSessionLocal()
        return session, True

    async def get_product_status_counts(
        self, tenant_id: str, timeframe_hours: int = 24
    ) -> ProductStatusSummary:
        """
        Calcula o volume de produtos agrupados por status para o tenant_id especificado
        dentro da janela temporal informada.
        """
        session, owned = await self._get_session()
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=timeframe_hours)
            stmt = (
                select(ProductModel.status, func.count(ProductModel.id))
                .where(
                    ProductModel.tenant_id == tenant_id,
                    ProductModel.created_at >= cutoff,
                )
                .group_by(ProductModel.status)
            )
            result = await session.execute(stmt)
            rows = result.all()

            status_map = {"raw": 0, "processing": 0, "processed": 0, "failed": 0}
            for status_val, count in rows:
                if status_val:
                    key = str(status_val).lower().strip()
                    if key in status_map:
                        status_map[key] += count

            return ProductStatusSummary(**status_map)
        finally:
            if owned:
                await session.close()

    async def get_token_usage_by_provider(
        self, tenant_id: str, timeframe_hours: int = 24
    ) -> List[TokenTelemetrySchema]:
        """
        Retorna o consumo de tokens acumulado por provedor de IA para o tenant_id
        na janela temporal solicitada.
        """
        session, owned = await self._get_session()
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=timeframe_hours)
            stmt = (
                select(
                    TokenTelemetryModel.provider,
                    func.coalesce(func.sum(TokenTelemetryModel.prompt_tokens), 0).label("prompt_tokens"),
                    func.coalesce(func.sum(TokenTelemetryModel.completion_tokens), 0).label("completion_tokens"),
                    func.coalesce(func.sum(TokenTelemetryModel.total_tokens), 0).label("total_tokens"),
                )
                .where(
                    TokenTelemetryModel.tenant_id == tenant_id,
                    TokenTelemetryModel.created_at >= cutoff,
                )
                .group_by(TokenTelemetryModel.provider)
            )
            result = await session.execute(stmt)
            rows = result.all()

            return [
                TokenTelemetrySchema(
                    provider=row.provider,
                    total_prompt_tokens=int(row.prompt_tokens),
                    total_completion_tokens=int(row.completion_tokens),
                    total_tokens=int(row.total_tokens),
                )
                for row in rows
            ]
        finally:
            if owned:
                await session.close()

    async def get_average_latency(
        self, tenant_id: str, timeframe_hours: int = 24
    ) -> float:
        """
        Calcula a latência média (duration_ms) dos robôs para o tenant_id
        na janela temporal especificada.
        """
        session, owned = await self._get_session()
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=timeframe_hours)
            stmt = (
                select(func.avg(RobotActivityModel.duration_ms))
                .where(
                    RobotActivityModel.tenant_id == tenant_id,
                    RobotActivityModel.created_at >= cutoff,
                    RobotActivityModel.duration_ms.isnot(None),
                )
            )
            result = await session.execute(stmt)
            avg_latency = result.scalar()
            return round(float(avg_latency), 2) if avg_latency is not None else 0.0
        finally:
            if owned:
                await session.close()

    async def get_recent_activities(
        self, tenant_id: str, limit: int = 20, offset: int = 0
    ) -> Tuple[List[RobotActivityModel], int]:
        """
        Retorna o histórico paginado de atividades dos robôs para o tenant_id,
        ordenado do mais recente para o mais antigo, além do total de registros.
        """
        session, owned = await self._get_session()
        try:
            # Query paginada
            stmt = (
                select(RobotActivityModel)
                .where(RobotActivityModel.tenant_id == tenant_id)
                .order_by(RobotActivityModel.created_at.desc())
                .offset(offset)
                .limit(limit)
            )
            result = await session.execute(stmt)
            activities = list(result.scalars().all())

            # Contagem total
            count_stmt = (
                select(func.count(RobotActivityModel.id))
                .where(RobotActivityModel.tenant_id == tenant_id)
            )
            count_result = await session.execute(count_stmt)
            total = count_result.scalar_one() or 0

            return activities, total
        finally:
            if owned:
                await session.close()

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
