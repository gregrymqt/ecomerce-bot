import time
import uuid
import logging
from typing import Optional, Callable
from fastapi import Request, HTTPException, status
from app.core.config.redis_db import redis_cache

logger = logging.getLogger(__name__)


class RedisRateLimiter:
    """
    Limitador de taxa assíncrono baseado no algoritmo de Janela Deslizante (Sliding Window) usando Redis Sorted Sets.
    """

    def __init__(self, redis_client=None):
        self._custom_redis = redis_client

    def _get_client(self):
        return self._custom_redis if self._custom_redis is not None else redis_cache.redis_client

    async def is_rate_limited(self, key: str, times: int, seconds: int) -> bool:
        """
        Verifica se a chave atingiu o limite de 'times' dentro da janela de 'seconds' segundos.
        Retorna True se o limite foi excedido, False caso contrário.
        """
        client = self._get_client()
        if not client:
            logger.warning(f"[RateLimiter] Redis indisponível. Permitindo requisição para a chave '{key}'.")
            return False

        now = time.time()
        window_start = now - seconds
        member_id = f"{now}:{uuid.uuid4().hex}"

        try:
            # 1. Remove registros fora da janela deslizante atual
            await client.zremrangebyscore(key, 0, window_start)

            # 2. Conta quantas requisições foram feitas dentro da janela ativa
            current_count = await client.zcard(key)

            if current_count >= times:
                logger.warning(f"[RateLimiter] Limite excedido para chave '{key}'. ({current_count}/{times} em {seconds}s)")
                return True

            # 3. Adiciona a nova requisição com timestamp como score e define a expiração da chave
            pipe = client.pipeline()
            pipe.zadd(key, {member_id: now})
            pipe.expire(key, seconds + 10)
            await pipe.execute()

            return False
        except Exception as err:
            logger.error(f"[RateLimiter] Erro de comunicação com o Redis para chave '{key}': {err}")
            # Resiliência: em caso de falha no Redis, permite a requisição
            return False


def rate_limit_dependency(times: int, seconds: int) -> Callable:
    """
    Dependência FastAPI reutilizável para aplicar Rate Limiting dinâmico por IP ou Tenant.
    - Se o header X-Tenant-ID for informado: rate_limit:tenant:{tenant_id}:{route_path}
    - Caso contrário: rate_limit:ip:{client_ip}:{route_path}
    """
    async def dependency(request: Request):
        tenant_id = request.headers.get("X-Tenant-ID") or request.headers.get("x-tenant-id")
        route_path = request.url.path

        if tenant_id:
            cache_key = f"rate_limit:tenant:{tenant_id}:{route_path}"
        else:
            client_ip = request.client.host if request.client and request.client.host else "unknown"
            cache_key = f"rate_limit:ip:{client_ip}:{route_path}"

        limiter = RedisRateLimiter()
        is_limited = await limiter.is_rate_limited(key=cache_key, times=times, seconds=seconds)

        if is_limited:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please try again later.",
                headers={"Retry-After": str(seconds)}
            )

    return dependency


async def check_demo_rate_limit(request: Request, max_requests: int = 5, window_seconds: int = 3600):
    """
    Rate limiter baseado em Redis para controle de IP em ambiente de demonstração (Manutenção de compatibilidade).
    """
    client_ip = request.client.host if request.client and request.client.host else "unknown"
    cache_key = f"rate_limit:demo:{client_ip}"

    try:
        current_requests = await redis_cache.incr(cache_key)

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
        logger.error(f"Erro ao verificar rate limit no Redis para o IP {client_ip}: {err}")