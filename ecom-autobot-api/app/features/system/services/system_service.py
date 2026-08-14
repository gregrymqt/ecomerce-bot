import logging
from typing import Dict, List, Optional, Tuple
import aio_pika
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import AsyncSessionLocal
from app.core.config.rabbitmq import get_rabbitmq_connection
from app.core.config.redis_db import redis_cache
from app.features.scraper.schemas import ImportRequestMessage
from app.features.system.repositories.telemetry_repository import TelemetryRepository
from app.features.system.schemas.system_schemas import (
    DashboardTelemetryResponse,
    RobotActivitySchema,
    SystemHealthDetails,
)

logger = logging.getLogger(__name__)

TIMEFRAME_HOURS: Dict[str, int] = {
    "24h": 24,
    "7d": 168,
    "30d": 720,
}


class SystemService:
    def __init__(
        self,
        telemetry_repo: Optional[TelemetryRepository] = None,
        repository: Optional[TelemetryRepository] = None,
        session: Optional[AsyncSession] = None,
    ):
        self.telemetry_repo = telemetry_repo or repository or TelemetryRepository(session=session)

    async def get_telemetry_metrics(
        self, tenant_id: str, timeframe: str = "24h"
    ) -> DashboardTelemetryResponse:
        """
        Retorna as métricas e KPIs consolidados do dashboard do tenant.
        Aplica cache Redis com TTL curto de 30 segundos (Cache-Aside).
        """
        tf_clean = timeframe.lower().strip() if timeframe else "24h"
        hours = TIMEFRAME_HOURS.get(tf_clean, 24)
        cache_key = f"telemetry:{tenant_id}:{tf_clean}"

        # 1. Tenta recuperar do cache Redis
        try:
            cached_metrics = await redis_cache.get_model(
                cache_key, DashboardTelemetryResponse
            )
            if cached_metrics is not None:
                logger.info(f"Hit de cache Redis para telemetria de tenant '{tenant_id}' (timeframe: {tf_clean})")
                return cached_metrics
        except Exception as cache_err:
            logger.warning(f"Falha ao ler cache Redis de telemetria: {cache_err}")

        # 2. Cache Miss: Executa as consultas no repositório
        logger.info(f"Miss de cache Redis. Calculando telemetria para tenant '{tenant_id}' (timeframe: {tf_clean})")
        status_summary = await self.telemetry_repo.get_product_status_counts(
            tenant_id, timeframe_hours=hours
        )
        tokens_by_provider = await self.telemetry_repo.get_token_usage_by_provider(
            tenant_id, timeframe_hours=hours
        )
        avg_latency_ms = await self.telemetry_repo.get_average_latency(
            tenant_id, timeframe_hours=hours
        )

        # Horas economizadas estimadas: ~0.25h (15 min) de trabalho manual por produto processado
        hours_saved = round(status_summary.processed * 0.25, 2)

        response = DashboardTelemetryResponse(
            status_summary=status_summary,
            tokens_by_provider=tokens_by_provider,
            average_latency_ms=avg_latency_ms,
            hours_saved=hours_saved,
        )

        # 3. Salva no Redis com TTL de 30 segundos
        try:
            await redis_cache.set(cache_key, response, expire_seconds=30)
        except Exception as cache_err:
            logger.warning(f"Falha ao gravar cache Redis de telemetria: {cache_err}")

        return response

    async def get_recent_activities(
        self, tenant_id: str, limit: int = 20, offset: int = 0
    ) -> Tuple[List[RobotActivitySchema], int]:
        """
        Retorna o histórico de execuções dos robôs em formato de Schemas Pydantic.
        """
        activity_models, total = await self.telemetry_repo.get_recent_activities(
            tenant_id=tenant_id, limit=limit, offset=offset
        )

        schemas = [
            RobotActivitySchema(
                id=act.id,
                worker_type=act.worker_type,
                status=act.status,
                details=str(act.details) if act.details is not None else None,
                duration_ms=act.duration_ms,
                created_at=act.created_at,
            )
            for act in activity_models
        ]

        return schemas, total

    @staticmethod
    async def check_system_health() -> SystemHealthDetails:
        """
        Realiza checagens assíncronas em tempo real nos serviços auxiliares:
        - PostgreSQL (SELECT 1)
        - Redis (ping)
        - RabbitMQ (verificação de conexão)
        """
        # 1. PostgreSQL Check
        db_ok = False
        try:
            async with AsyncSessionLocal() as session:
                result = await session.execute(select(1))
                db_ok = (result.scalar() == 1)
        except Exception as e:
            logger.warning(f"Health check PostgreSQL falhou: {e}")

        # 2. Redis Check
        redis_ok = False
        try:
            if redis_cache.redis_client:
                await redis_cache.redis_client.ping()
                redis_ok = True
        except Exception as e:
            logger.warning(f"Health check Redis falhou: {e}")

        # 3. RabbitMQ Check
        rabbitmq_ok = False
        try:
            connection = await get_rabbitmq_connection()
            if connection and not connection.is_closed:
                rabbitmq_ok = True
        except Exception as e:
            logger.warning(f"Health check RabbitMQ falhou: {e}")

        overall_status = "ok" if (db_ok and redis_ok and rabbitmq_ok) else "degraded"

        return SystemHealthDetails(
            database=db_ok,
            redis=redis_ok,
            rabbitmq=rabbitmq_ok,
            status=overall_status,
        )

    @staticmethod
    async def process_demo_request(urls: List[str]) -> None:
        connection = await get_rabbitmq_connection()
        async with connection:
            channel = await connection.channel()

            for url in urls:
                msg_data = ImportRequestMessage(
                    target_url=url,
                    tenant_id="demo_tenant",
                    product_id="demo",
                )

                message = aio_pika.Message(
                    body=msg_data.model_dump_json(by_alias=True).encode(),
                    priority=10,
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                )

                await channel.default_exchange.publish(
                    message,
                    routing_key="demo_ecommerce",
                )

    @staticmethod
    async def process_export(tenant_id: str, platform: str) -> None:
        from app.features.scraper.workers.exporter_worker import ExporterWorker

        logger.info(f"Processando exportação para tenant: {tenant_id}, plataforma: {platform}")
        exporter = ExporterWorker(tenant_id=tenant_id, platform=platform)
        await exporter.export()
