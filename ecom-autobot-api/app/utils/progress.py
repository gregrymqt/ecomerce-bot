import json
import logging
from app.config.redis_db import redis_cache

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
