import json
import logging
from app.core.config.redis_db import redis_cache

logger = logging.getLogger(__name__)

async def publish_demo_progress(url: str, status: str, progress: int, original: dict = None, enhanced: dict = None, error: str = None):
    """
    Publica o progresso de extração/enriquecimento da demo no Redis Pub/Sub.
    """
    if not redis_cache.redis_client:
        logger.warning("Redis não conectado. Impossível publicar progresso da demo.")
        return
        
    payload = {
        "url": url,
        "status": status,
        "progress": progress
    }
    if original:
        payload["original"] = original
    if enhanced:
        payload["enhanced"] = enhanced
    if error:
        payload["error"] = error
        
    try:
        await redis_cache.redis_client.publish("demo_progress", json.dumps(payload))
    except Exception as e:
        logger.error(f"Erro ao publicar progresso da demo no Redis: {e}")


async def publish_export_progress(
    tenant_id: str,
    event: str,
    total_items: int = 0,
    processed_items: int = 0,
    percentage: float = 0.0,
    status: str = "PROCESSING",
    error: str = None
) -> None:
    """
    Publica eventos de telemetria da exportação no Redis Pub/Sub (nos canais 'demo_progress' e 'export_progress').
    """
    if not redis_cache.redis_client:
        logger.warning("Redis não conectado. Impossível publicar telemetria de exportação.")
        return

    payload = {
        "event": event,
        "tenant_id": tenant_id,
        "total_items": total_items,
        "processed_items": processed_items,
        "percentage": percentage,
        "status": status,
    }
    if error:
        payload["error"] = error

    try:
        data_str = json.dumps(payload)
        await redis_cache.redis_client.publish("demo_progress", data_str)
        await redis_cache.redis_client.publish("export_progress", data_str)
    except Exception as e:
        logger.error(f"Erro ao publicar telemetria de exportação no Redis: {e}")

