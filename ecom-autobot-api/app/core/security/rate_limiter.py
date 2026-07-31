import logging
from fastapi import Request, HTTPException, status
from app.core.config.redis_db import redis_cache

logger = logging.getLogger(__name__)

async def check_demo_rate_limit(request: Request, max_requests: int = 5, window_seconds: int = 3600):
    """
    Rate limiter baseado em Redis para controle de IP em ambiente de demonstração.
    """
    client_ip = request.client.host if request.client and request.client.host else "unknown"
    cache_key = f"rate_limit:demo:{client_ip}"

    try:
        # Incrementa o contador de requisições do IP no Redis
        current_requests = await redis_cache.incr(cache_key)

        # Na primeira requisição, define a janela de expiração (1 hora)
        if current_requests == 1:
            await redis_cache.expire(cache_key, window_seconds)

        if current_requests > max_requests:
            logger.warning(f"Rate limit excedido para o IP: {client_ip}. Tentativas: {current_requests}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Limite de demonstração excedido para o seu IP. Tente novamente mais tarde."
            )
    except HTTPException:
        raise
    except Exception as err:
        # Em caso de falha temporária do Redis, registra o log sem derrubar a API
        logger.error(f"Erro ao verificar rate limit no Redis para o IP {client_ip}: {err}")