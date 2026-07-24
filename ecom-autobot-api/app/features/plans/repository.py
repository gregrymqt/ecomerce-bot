from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional, Sequence

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import AsyncSessionLocal
from app.core.config.redis_db import redis_cache
from app.features.plans.models import PlanModel

logger = logging.getLogger(__name__)


class PlansRepository:
    """
    Repositório assíncrono para manipulação da tabela de Planos com
    estratégia de Cache-Aside e invalidação em tempo real via Redis.
    """

    CACHE_TTL = 3600  # 1 hora em segundos

    def __init__(self, session: Optional[AsyncSession] = None):
        self.session = session

    async def _get_session(self) -> tuple[AsyncSession, bool]:
        """
        Retorna a sessão injetada ou cria uma nova sessão AsyncSessionLocal.
        Retorna uma tupla (session, owned) indicando se a sessão deve ser fechada.
        """
        if self.session is not None:
            return self.session, False
        session = AsyncSessionLocal()
        return session, True

    # =========================================================================
    # Métodos Auxiliares de Serialização e Invalidação
    # =========================================================================

    def _model_to_dict(self, model: PlanModel) -> Dict[str, Any]:
        """Converte uma instância do SQLAlchemy PlanModel para um dicionário serializável."""
        return {
            "id": model.id,
            "reason": model.reason,
            "status": model.status,
            "auto_recurring": model.auto_recurring,
            "back_url": model.back_url,
            "collector_id": model.collector_id,
            "application_id": model.application_id,
            "created_at": model.created_at.isoformat() if model.created_at else None,
            "updated_at": model.updated_at.isoformat() if model.updated_at else None,
        }

    def _dict_to_model(self, data: Dict[str, Any]) -> PlanModel:
        """Reconstrói um PlanModel a partir de um dicionário recuperado do Redis."""
        return PlanModel(
            id=data["id"],
            reason=data["reason"],
            status=data["status"],
            auto_recurring=data.get("auto_recurring", {}),
            back_url=data.get("back_url"),
            collector_id=data.get("collector_id"),
            application_id=data.get("application_id"),
            created_at=(
                datetime.fromisoformat(data["created_at"])
                if data.get("created_at")
                else datetime.now(timezone.utc)
            ),
            updated_at=(
                datetime.fromisoformat(data["updated_at"])
                if data.get("updated_at")
                else datetime.now(timezone.utc)
            ),
        )

    async def _invalidate_plan_cache(self, plan_id: str) -> None:
        """Invalida a chave individual do plano e os caches de listagem/busca."""
        try:
            # 1. Apaga cache individual
            if redis_cache.redis_client:
                await redis_cache.redis_client.delete(f"plan:{plan_id}")

            # 2. Invalida todas as chaves de listagem
            await self._invalidate_list_cache()
            logger.info(f"[PlansRepository] Cache do plano '{plan_id}' e listas invalidados com sucesso.")
        except Exception as err:
            logger.warning(f"[PlansRepository] Falha ao invalidar cache do plano '{plan_id}': {err}")

    async def _invalidate_list_cache(self) -> None:
        """Invalida todas as consultas de listagem em cache."""
        try:
            if redis_cache.redis_client:
                keys = await redis_cache.redis_client.keys("plans:list:*")
                if keys:
                    await redis_cache.redis_client.delete(*keys)
        except Exception as err:
            logger.warning(f"[PlansRepository] Falha ao limpar cache de listas de planos: {err}")

    # =========================================================================
    # Métodos de Leitura (Com get_or_create / Cache-Aside)
    # =========================================================================

    async def get_by_id(self, plan_id: str) -> Optional[PlanModel]:
        """
        Busca um plano pelo ID. Tenta recuperar do Redis primeiro (get_or_create);
        se não existir, executa a consulta no PostgreSQL e salva no cache.
        """
        cache_key = f"plan:{plan_id}"

        async def fetch_from_db() -> Optional[Dict[str, Any]]:
            logger.info(f"[PlansRepository] Cache Miss. Buscando plano '{plan_id}' no banco de dados.")
            session, owned = await self._get_session()
            try:
                stmt = select(PlanModel).where(PlanModel.id == plan_id)
                result = await session.execute(stmt)
                plan = result.scalar_one_or_none()
                return self._model_to_dict(plan) if plan else None
            finally:
                if owned:
                    await session.close()

        cached_data = await redis_cache.get_or_create(
            key=cache_key,
            factory=fetch_from_db,
            expire_seconds=self.CACHE_TTL,
        )

        if cached_data and isinstance(cached_data, dict):
            return self._dict_to_model(cached_data)

        return None

    async def list_plans(self, limit: int = 50, offset: int = 0) -> Sequence[PlanModel]:
        """
        Lista planos locais ordenados por data de criação.
        Utiliza cache para evitar chamadas repetitivas ao banco.
        """
        cache_key = f"plans:list:{limit}:{offset}"

        async def fetch_from_db() -> List[Dict[str, Any]]:
            logger.info(f"[PlansRepository] Cache Miss. Buscando lista de planos (limit={limit}, offset={offset}) no banco.")
            session, owned = await self._get_session()
            try:
                stmt = (
                    select(PlanModel)
                    .order_by(PlanModel.created_at.desc())
                    .offset(offset)
                    .limit(limit)
                )
                result = await session.execute(stmt)
                plans = result.scalars().all()
                return [self._model_to_dict(p) for p in plans]
            finally:
                if owned:
                    await session.close()

        cached_list = await redis_cache.get_or_create(
            key=cache_key,
            factory=fetch_from_db,
            expire_seconds=self.CACHE_TTL,
        )

        if isinstance(cached_list, list):
            return [self._dict_to_model(item) for item in cached_list if isinstance(item, dict)]

        return []

    # =========================================================================
    # Métodos de Escrita (Com Invalidação de Cache)
    # =========================================================================

    async def save(self, plan_model: PlanModel) -> PlanModel:
        """
        Salva um novo registro de plano localmente e invalida as consultas de listagem no Redis.
        """
        session, owned = await self._get_session()
        try:
            session.add(plan_model)
            await session.commit()
            await session.refresh(plan_model)
        except Exception as e:
            if owned:
                await session.rollback()
            logger.error(f"[PlansRepository] Erro ao salvar plano '{plan_model.id}': {e}")
            raise
        finally:
            if owned:
                await session.close()

        # Invalida listas (pois um novo item foi adicionado)
        await self._invalidate_list_cache()

        # Popula a chave individual no Redis
        cache_key = f"plan:{plan_model.id}"
        await redis_cache.set(cache_key, self._model_to_dict(plan_model), expire_seconds=self.CACHE_TTL)

        return plan_model

    async def update(self, plan_id: str, values: Dict[str, Any]) -> Optional[PlanModel]:
        """
        Atualiza um plano localmente e invalida suas chaves correspondentes no Redis.
        """
        values["updated_at"] = datetime.now(timezone.utc)

        session, owned = await self._get_session()
        try:
            stmt = (
                update(PlanModel)
                .where(PlanModel.id == plan_id)
                .values(**values)
                .execution_options(synchronize_session="fetch")
            )
            await session.execute(stmt)
            await session.commit()
        except Exception as e:
            if owned:
                await session.rollback()
            logger.error(f"[PlansRepository] Erro ao atualizar plano '{plan_id}': {e}")
            raise
        finally:
            if owned:
                await session.close()

        # Invalida cache do item e de listagens
        await self._invalidate_plan_cache(plan_id)

        # Retorna a versão atualizada (que vai repopular o cache no próximo get_by_id se necessário)
        return await self.get_by_id(plan_id)