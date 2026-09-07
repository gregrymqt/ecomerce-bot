import json
import asyncio
import os
import random
from typing import TypeVar, Type, Optional, Callable, Union, Any, Awaitable
from pydantic import BaseModel
import redis.asyncio as redis
from app.core.config.settings import settings
from app.core.shared.logger import get_logger

logger = get_logger("worker.redis")

T = TypeVar("T")

class RedisCache:
    """
    Gerenciador de cache e coordenação efêmera assíncrona com Redis.
    Implementa o padrão SafeCache para proteção contra Cache Stampede (lock local + jitter),
    métodos de controle de idempotência (SET NX) e pooling resiliente de conexões.
    """

    def __init__(self) -> None:
        self.redis_client: Optional[redis.Redis] = None
        self._pool: Optional[redis.ConnectionPool] = None
        self._locks: dict[str, asyncio.Lock] = {}

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

        logger.info(f"Conectando ao Redis em {redis_url}")

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
            logger.info("Conectado ao Redis com sucesso.")
        except (redis.AuthenticationError, redis.exceptions.AuthenticationError) as e:
            logger.error(f"Erro de autenticação no Redis: Credenciais incorretas ou senha requerida: {e}")
            self.redis_client = None
        except redis.ConnectionError as e:
            logger.warning(
                f"Não foi possível conectar ao Redis em {redis_url}. "
                f"O Redis ficará indisponível até reconexão: {e}"
            )
            self.redis_client = None

    async def disconnect(self) -> None:
        if self.redis_client:
            logger.info("Desconectando do Redis...")
            await self.redis_client.aclose()
            self.redis_client = None
        if self._pool:
            await self._pool.disconnect()
            self._pool = None

    async def ping(self) -> bool:
        """Verifica se a conexão ativa com o Redis está operacional (Readiness probe)."""
        if not self.redis_client:
            return False
        try:
            return bool(await self.redis_client.ping())
        except Exception:
            return False

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
            logger.warning(f"Redis indisponível ao ler chave {key}.")
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
            logger.warning(f"Redis indisponível ao gravar chave {key}.")

    async def incr(self, key: str, amount: int = 1) -> int:
        """Incrementa atômico tipado para Rate Limiters e Contadores."""
        if not self.redis_client:
            return 0
        try:
            return await self.redis_client.incr(key, amount)
        except redis.ConnectionError:
            logger.warning(f"Redis indisponível ao incrementar chave {key}.")
            return 0

    async def expire(self, key: str, time: int) -> bool:
        """Define expiração atômica em segundos para uma chave."""
        if not self.redis_client:
            return False
        try:
            return await self.redis_client.expire(key, time)
        except redis.ConnectionError:
            logger.warning(f"Redis indisponível ao definir expiração na chave {key}.")
            return False

    async def delete(self, key: str) -> int:
        """Remove uma chave do Redis."""
        if not self.redis_client:
            return 0
        try:
            return await self.redis_client.delete(key)
        except redis.ConnectionError:
            logger.warning(f"Redis indisponível ao deletar chave {key}.")
            return 0

    async def get_or_compute(
        self,
        key: str,
        compute_fn: Callable[[], Union[T, Awaitable[T]]],
        base_ttl: int = 300
    ) -> T:
        """
        Padrão SafeCache: Protege contra Cache Stampede com bloqueio local asyncio.Lock,
        double-check e adição de Jitter aleatório (até 10%) no TTL para evitar expiração em massa.
        """
        # 1. Fast Path
        cached = await self.get(key)
        if cached is not None:
            return cached  # type: ignore

        # 2. Bloqueio por chave para evitar cálculo redundante concorrente
        lock = self._locks.setdefault(key, asyncio.Lock())
        async with lock:
            # 3. Double-check após adquirir o lock
            cached = await self.get(key)
            if cached is not None:
                return cached  # type: ignore

            # 4. Executa computação
            if asyncio.iscoroutinefunction(compute_fn):
                result = await compute_fn()
            else:
                result = compute_fn()

            if result is not None:
                # 5. Aplica Jitter (variação de até 10%)
                jitter = random.randint(0, max(1, int(base_ttl * 0.1)))
                await self.set(key, result, expire_seconds=base_ttl + jitter)

            return result

    async def get_or_create(self, key: str, factory: Callable[[], T], expire_seconds: int = 3600) -> T:
        """Mantido para compatibilidade — delega internamente para get_or_compute com SafeCache."""
        return await self.get_or_compute(key, factory, base_ttl=expire_seconds)

    async def set_idempotency_key(
        self,
        key: str,
        value: str = "processed",
        ttl_seconds: int = 86400
    ) -> bool:
        """
        Registra uma chave de idempotência de 24h via SET NX (apenas se não existir).
        Retorna True se foi registrada com sucesso (primeira execução).
        Retorna False se a chave já existia (execução duplicada).
        """
        if not self.redis_client:
            # Se Redis offline, não impede execução mas registra alerta
            logger.warning("Redis offline ao registrar idempotência. Continuando sem deduplicação.")
            return True

        try:
            result = await self.redis_client.set(key, value, ex=ttl_seconds, nx=True)
            return bool(result)
        except redis.ConnectionError:
            logger.warning(f"Erro de conexão Redis ao verificar idempotência da chave {key}.")
            return True

    async def is_already_processed(self, key: str) -> bool:
        """Verifica se uma chave de idempotência já existe."""
        if not self.redis_client:
            return False
        try:
            return bool(await self.redis_client.exists(key))
        except redis.ConnectionError:
            return False


# Instância global com suporte a autocompletar completo
redis_cache = RedisCache()