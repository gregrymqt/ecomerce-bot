import json
import asyncio
import os
import logging
from typing import TypeVar, Type, Optional, Callable, Union, Any
from pydantic import BaseModel
import redis.asyncio as redis
from app.core.config.settings import settings

logger = logging.getLogger(__name__)

T = TypeVar("T")

class RedisCache:
    def __init__(self) -> None:
        self.redis_client: Optional[redis.Redis] = None
        self._pool: Optional[redis.ConnectionPool] = None

    @property
    def client(self) -> Optional[redis.Redis]:
        """Propriedade com tipagem explícita para acesso direto ao cliente nativo."""
        return self.redis_client

    async def connect(self) -> None:
        if not settings.REDIS_URL:
            logger.warning("REDIS_URL não configurada. Redis desabilitado.")
            return

        redis_url = settings.REDIS_URL
        redis_password = settings.REDIS_PASSWORD or os.getenv("REDIS_PASSWORD")

        logger.info(f"Connecting to Redis at {redis_url}")

        kwargs: dict[str, Any] = {
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

    async def disconnect(self) -> None:
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
                except (json.JSONDecodeError, TypeError):
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

    async def set(
        self, 
        key: str, 
        value: Union[str, int, float, dict, list, BaseModel], 
        expire_seconds: int = 3600
    ) -> None:
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

    async def incr(self, key: str, amount: int = 1) -> int:
        """Incrementa atômico tipado para Rate Limiters e Contadores."""
        if not self.redis_client:
            return 0
        try:
            return await self.redis_client.incr(key, amount)
        except redis.ConnectionError:
            logger.warning("Redis indisponível ao incrementar chave %s.", key)
            return 0

    async def expire(self, key: str, time: int) -> bool:
        """Define expiração atômica em segundos para uma chave."""
        if not self.redis_client:
            return False
        try:
            return await self.redis_client.expire(key, time)
        except redis.ConnectionError:
            logger.warning("Redis indisponível ao definir expiração na chave %s.", key)
            return False

    async def delete(self, key: str) -> int:
        """Remove uma chave do Redis."""
        if not self.redis_client:
            return 0
        try:
            return await self.redis_client.delete(key)
        except redis.ConnectionError:
            logger.warning("Redis indisponível ao deletar chave %s.", key)
            return 0

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


# Instância global com suporte a autocompletar completo
redis_cache = RedisCache()