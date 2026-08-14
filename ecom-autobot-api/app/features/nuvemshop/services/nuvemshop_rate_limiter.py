import asyncio
import logging
import time
from typing import Optional

from app.core.config.redis_db import redis_cache

logger = logging.getLogger(__name__)


class NuvemshopRateLimiter:
    """
    Rate Limiter Assíncrono baseado em Sliding Window / Token Bucket no Redis para a API Nuvemshop.
    Garante respeito ao limite de requisições por segundo por store_id e isolamento de locks HTTP 429.
    """

    DEFAULT_MAX_REQUESTS_PER_SEC: float = 2.0  # Limite sustentável de 2 requisições/segundo por loja
    LOCK_429_PREFIX: str = "ecom:lock:nuvemshop:429"
    RATELIMIT_PREFIX: str = "ecom:ratelimit:nuvemshop"

    @classmethod
    async def acquire_ticket(
        self,
        store_id: str,
        max_requests_per_sec: Optional[float] = None,
    ) -> None:
        """
        Aguarda se a loja estiver em lock por HTTP 429 ou se exceder a cota sustentada por segundo.
        """
        if not store_id:
            return

        rate_limit = max_requests_per_sec or self.DEFAULT_MAX_REQUESTS_PER_SEC
        lock_429_key = f"{self.LOCK_429_PREFIX}:{store_id}"
        ratelimit_key = f"{self.RATELIMIT_PREFIX}:{store_id}"

        # 1. Verifica se a loja específica está sob lock temporário devido a HTTP 429
        if redis_cache.redis_client:
            try:
                ttl = await redis_cache.redis_client.ttl(lock_429_key)
                if ttl and ttl > 0:
                    logger.warning(
                        f"⏳ [NuvemshopRateLimiter] Loja '{store_id}' em lock 429 por mais {ttl}s. Aguardando liberação..."
                    )
                    await asyncio.sleep(ttl + 0.5)
            except Exception as e:
                logger.error(f"[NuvemshopRateLimiter] Erro ao verificar lock 429 no Redis: {e}")

        # 2. Algoritmo Sliding Window com Sorted Set (ZSET) no Redis
        if redis_cache.redis_client:
            try:
                now = time.time()
                window_start = now - 1.0  # Janela deslizante de 1 segundo

                async with redis_cache.redis_client.pipeline(transaction=True) as pipe:
                    # Limpa requisições mais antigas que 1 segundo atrás
                    pipe.zremrangebyscore(ratelimit_key, 0, window_start)
                    # Conta requisições no último segundo
                    pipe.zcard(ratelimit_key)
                    # Adiciona timestamp atual
                    pipe.zadd(ratelimit_key, {str(now): now})
                    # Define TTL de segurança para a chave do ratelimit (10 segundos)
                    pipe.expire(ratelimit_key, 10)
                    results = await pipe.execute()

                current_count = results[1]
                if current_count >= rate_limit:
                    sleep_time = (1.0 / rate_limit)
                    logger.debug(f"[NuvemshopRateLimiter] Cota excedida para loja '{store_id}' ({current_count} req/s). Pausando {sleep_time:.2f}s...")
                    await asyncio.sleep(sleep_time)

            except Exception as e:
                logger.error(f"[NuvemshopRateLimiter] Erro ao executar Sliding Window no Redis: {e}")
                # Fallback em memória caso Redis apresente indisponibilidade pontual
                await asyncio.sleep(1.0 / rate_limit)
        else:
            await asyncio.sleep(1.0 / rate_limit)

    @classmethod
    async def notify_rate_limit(self, store_id: str, retry_after_seconds: int = 10) -> None:
        """
        Registra no Redis que a loja específica sofreu HTTP 429 na Nuvemshop.
        Aplica lock temporário apenas para o store_id afetado.
        """
        if not store_id:
            return

        lock_429_key = f"{self.LOCK_429_PREFIX}:{store_id}"
        ttl_seconds = max(retry_after_seconds, 2)

        logger.warning(
            f"🚨 [NuvemshopRateLimiter] HTTP 429 recebido para loja '{store_id}'. Bloqueando chamadas por {ttl_seconds}s (Retry-After)."
        )

        if redis_cache.redis_client:
            try:
                await redis_cache.redis_client.set(lock_429_key, "1", ex=ttl_seconds)
            except Exception as e:
                logger.error(f"[NuvemshopRateLimiter] Falha ao registrar lock 429 no Redis: {e}")
