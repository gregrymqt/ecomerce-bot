import asyncio
import logging
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.system_service import SystemService
from app.dependencies.rate_limiter import check_demo_rate_limit
from app.config.redis_db import redis_cache

logger = logging.getLogger(__name__)
router = APIRouter(tags=["System Operations"])

class DemoRequest(BaseModel):
    urls: List[str]

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
async def export_data(tenant_id: str, platform: str = "shopify"):
    try:
        await SystemService.process_export(tenant_id, platform)
        return {"status": "success", "message": f"Exportação concluída para a plataforma {platform}. Arquivo gerado no servidor."}
    except Exception as e:
        logger.error(f"Erro ao exportar dados: {e}")
        raise HTTPException(status_code=500, detail="Erro interno durante a exportação")

@router.get("/health")
async def health_check():
    return {"status": "ok"}

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
