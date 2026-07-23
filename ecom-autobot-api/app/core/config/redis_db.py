import json
import asyncio
import os
from typing import TypeVar, Type, Optional, Callable, Union
from pydantic import BaseModel
import redis.asyncio as redis
from app.core.config.settings import settings
import logging

logger = logging.getLogger(__name__)

T = TypeVar("T")

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

    async def get(self, key: str) -> Optional[Union[str, dict, list, int, float, bool]]:
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

    async def get_model(self, key: str, model_cls: Type[BaseModel]) -> Optional[BaseModel]:
        data = await self.get(key)
        if isinstance(data, dict):
            return model_cls.model_validate(data)
        elif isinstance(data, str):
            return model_cls.model_validate_json(data)
        return None

    async def set(self, key: str, value: Union[str, int, float, dict, list, BaseModel], expire_seconds: int = 3600):
        if not self.redis_client:
            return
        try:
            if isinstance(value, BaseModel):
                serialized = value.model_dump_json()
            elif isinstance(value, (dict, list)):
                serialized = json.dumps(value)
            else:
                serialized = str(value)
            await self.redis_client.set(key, serialized, ex=expire_seconds)
        except redis.ConnectionError:
            logger.warning("Redis indisponível ao gravar chave %s.", key)

    async def get_or_create(self, key: str, factory: Callable[[], T], expire_seconds: int = 3600) -> T:
        value = await self.get(key)
        if value is not None:
            return value  # type: ignore

        if asyncio.iscoroutinefunction(factory):
            new_value = await factory()
        else:
            new_value = factory()
            
        if new_value is not None:
            await self.set(key, new_value, expire_seconds)
            
        return new_value

# Instância global
redis_cache = RedisCache()
