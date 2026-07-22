import json
import asyncio
import os
from typing import Any, Optional, Callable
import redis.asyncio as redis
from app.config.settings import settings
import logging

logger = logging.getLogger(__name__)

class RedisCache:
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self._pool: Optional[redis.ConnectionPool] = None

    async def connect(self):
        if not settings.REDIS_URL:
            logger.warning("REDIS_URL não configurada. Redis desabilitado.")
            return

        redis_url = settings.REDIS_URL
        redis_password = settings.REDIS_PASSWORD or os.getenv("REDIS_PASSWORD")

        logger.info(f"Connecting to Redis at {redis_url}")

        kwargs = {
            "decode_responses": True,
            "max_connections": 20,
        }
        if redis_password and "@" not in redis_url:
            kwargs["password"] = redis_password

        try:
            self._pool = redis.ConnectionPool.from_url(redis_url, **kwargs)
            self.redis_client = redis.Redis(connection_pool=self._pool)
            await self.redis_client.ping()
            logger.info("Connected to Redis successfully.")
        except (redis.AuthenticationError, redis.exceptions.AuthenticationError) as e:
            logger.error("Erro de autenticação no Redis: Credenciais incorretas ou senha requerida. Detalhes: %s", e)
            self.redis_client = None
        except redis.ConnectionError as e:
            logger.warning(
                "Não foi possível conectar ao Redis em %s. "
                "O Redis ficará indisponível até reconexão. Detalhes: %s",
                redis_url,
                e,
            )
            self.redis_client = None

    async def disconnect(self):
        if self.redis_client:
            logger.info("Disconnecting from Redis...")
            await self.redis_client.aclose()
            self.redis_client = None
        if self._pool:
            await self._pool.disconnect()
            self._pool = None

    async def get(self, key: str) -> Optional[Any]:
        if not self.redis_client:
            return None
        try:
            value = await self.redis_client.get(key)
            if value:
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    return value
        except redis.ConnectionError:
            logger.warning("Redis indisponível ao ler chave %s.", key)
        return None

    async def set(self, key: str, value: Any, expire_seconds: int = 3600):
        if not self.redis_client:
            return
        try:
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            await self.redis_client.set(key, value, ex=expire_seconds)
        except redis.ConnectionError:
            logger.warning("Redis indisponível ao gravar chave %s.", key)

    async def get_or_create(self, key: str, factory: Callable, expire_seconds: int = 3600) -> Any:
        value = await self.get(key)
        if value is not None:
            return value

        if asyncio.iscoroutinefunction(factory):
            new_value = await factory()
        else:
            new_value = factory()
            
        if new_value is not None:
            await self.set(key, new_value, expire_seconds)
            
        return new_value

# Instância global
redis_cache = RedisCache()
