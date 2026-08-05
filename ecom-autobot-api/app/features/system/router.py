import asyncio
import logging
from typing import List, Literal, Optional
from fastapi import APIRouter, HTTPException, Depends, Header, Query, status
from fastapi.responses import StreamingResponse

from app.features.system.services import SystemService
from app.features.system.schemas import (
    DemoRequest,
    DashboardTelemetryResponse,
    RobotActivitySchema,
    SystemHealthDetails,
)
from app.core.security.rate_limiter import check_demo_rate_limit
from app.core.security.auth import get_current_tenant_user
from app.features.auth.schemas import AuthenticatedUser
from app.features.scraper.workers.exporter_worker import ExporterWorker
from app.core.config.redis_db import redis_cache

logger = logging.getLogger(__name__)
router = APIRouter(tags=["System / Dashboard"])


def get_system_service() -> SystemService:
    return SystemService()


@router.get("/telemetry", response_model=DashboardTelemetryResponse)
@router.get("/dashboard/telemetry", response_model=DashboardTelemetryResponse)
@router.get("/system/telemetry", response_model=DashboardTelemetryResponse)
async def get_dashboard_telemetry(
    timeframe: Literal["24h", "7d", "30d"] = Query("24h", description="Janela temporal de análise ('24h', '7d', '30d')"),
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
    service: SystemService = Depends(get_system_service),
):
    """
    Retorna métricas consolidadas do Dashboard (volume por status, tokens por provedor,
    latência média e horas economizadas) com cache Redis de 30s.
    """
    try:
        return await service.get_telemetry_metrics(tenant_id=x_tenant_id, timeframe=timeframe)
    except Exception as e:
        logger.error(f"Erro ao obter telemetria do dashboard para tenant '{x_tenant_id}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao gerar métricas do dashboard.",
        )


@router.get("/activities", response_model=List[RobotActivitySchema])
@router.get("/dashboard/activities", response_model=List[RobotActivitySchema])
@router.get("/system/activities", response_model=List[RobotActivitySchema])
async def get_dashboard_activities(
    limit: int = Query(20, ge=1, le=100, description="Quantidade de registros por página"),
    page: int = Query(1, ge=1, description="Número da página"),
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
    service: SystemService = Depends(get_system_service),
):
    """
    Retorna o histórico paginado de logs de execução dos robôs (ScraperWorker e ProcessorWorker).
    """
    try:
        offset = (page - 1) * limit
        activities, _ = await service.get_recent_activities(
            tenant_id=x_tenant_id, limit=limit, offset=offset
        )
        return activities
    except Exception as e:
        logger.error(f"Erro ao buscar atividades dos robôs para tenant '{x_tenant_id}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao consultar histórico de atividades.",
        )


@router.get("/health", response_model=SystemHealthDetails)
@router.get("/system/health", response_model=SystemHealthDetails)
async def health_check():
    """
    Realiza o health check assíncrono real de PostgreSQL, Redis e RabbitMQ.
    """
    return await SystemService.check_system_health()


@router.post("/demo", dependencies=[Depends(check_demo_rate_limit)])
async def request_demo(payload: DemoRequest):
    if len(payload.urls) > 3:
        raise HTTPException(status_code=400, detail="Máximo de 3 URLs permitidas para a demo.")

    try:
        await SystemService.process_demo_request(payload.urls)
        return {"status": "enviado_para_fila"}
    except Exception as e:
        logger.error(f"Erro ao publicar demo na fila: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao processar a solicitação")


@router.get("/export")
async def export_data(
    platform: str = Query("shopify", description="Plataforma de e-commerce ('shopify' ou 'nuvemshop')"),
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
):
    """
    Gera e transmite via StreamingResponse o arquivo CSV exportado para a plataforma especificada,
    isolado estritamente por tenant.
    """
    platform_clean = platform.lower().strip()
    if platform_clean not in ("shopify", "nuvemshop"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Plataforma '{platform}' não suportada. Escolha 'shopify' ou 'nuvemshop'.",
        )

    try:
        exporter = ExporterWorker(tenant_id=x_tenant_id, platform=platform_clean)
        filename = f"export_{platform_clean}_{x_tenant_id}.csv"
        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        }

        return StreamingResponse(
            exporter.stream_export(),
            media_type="text/csv",
            headers=headers,
        )
    except Exception as e:
        logger.error(f"Erro ao disparar streaming de exportação: {e}")
        raise HTTPException(status_code=500, detail="Erro interno durante a exportação de dados.")


@router.get("/demo/stream")
async def demo_stream():
    """
    Consome atualizações de progresso do canal 'demo_progress' no Redis
    e transmite em tempo real via Server-Sent Events (SSE).
    """
    if not redis_cache.redis_client:
        raise HTTPException(status_code=503, detail="Serviço de cache/stream indisponível.")

    async def event_generator():
        pubsub = redis_cache.redis_client.pubsub()
        await pubsub.subscribe("demo_progress")
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"]
                    yield f"data: {data}\n\n"
        except asyncio.CancelledError:
            logger.info("Cliente desconectou do SSE stream de demo.")
        finally:
            await pubsub.unsubscribe("demo_progress")
            await pubsub.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")
