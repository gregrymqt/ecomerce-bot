from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import AsyncSessionLocal
from app.core.config.redis_db import redis_cache
from app.features.subscriptions.domain.models import SubscriptionModel

logger = logging.getLogger(__name__)


class SubscriptionsRepository:
    """
    Repositório para persistência local de Assinaturas (PostgreSQL via SQLAlchemy 2.0 Async)
    com estratégia Cache-Aside via Redis e isolamento estrito Multi-Tenant.
    """

    def __init__(self, session: Optional[AsyncSession] = None):
        self.session = session

    async def _get_session(self) -> Tuple[AsyncSession, bool]:
        if self.session is not None:
            return self.session, False
        session = AsyncSessionLocal()
        return session, True

    @staticmethod
    def _get_cache_key_id(tenant_id: str, sub_id: str) -> str:
        return f"sub:{tenant_id}:{sub_id}"

    @staticmethod
    def _get_cache_key_ext(tenant_id: str, preapproval_id: str) -> str:
        return f"sub:ext:{tenant_id}:{preapproval_id}"

    @staticmethod
    def _model_to_dict(model: SubscriptionModel) -> Dict[str, Any]:
        return {
            "id": model.id,
            "tenant_id": model.tenant_id,
            "plan_id": model.plan_id,
            "preapproval_id": model.preapproval_id,
            "payer_email": model.payer_email,
            "status": model.status,
            "reason": model.reason,
            "external_reference": model.external_reference,
            "init_point": model.init_point,
            "payment_method_id": model.payment_method_id,
            "card_id": model.card_id,
            "auto_recurring": model.auto_recurring,
            "next_payment_date": model.next_payment_date.isoformat() if model.next_payment_date else None,
            "created_at": model.created_at.isoformat() if model.created_at else None,
            "updated_at": model.updated_at.isoformat() if model.updated_at else None,
        }

    @staticmethod
    def _dict_to_model(data: Dict[str, Any]) -> SubscriptionModel:
        clean_data = data.copy()
        if clean_data.get("next_payment_date"):
            clean_data["next_payment_date"] = datetime.fromisoformat(clean_data["next_payment_date"])
        if clean_data.get("created_at"):
            clean_data["created_at"] = datetime.fromisoformat(clean_data["created_at"])
        if clean_data.get("updated_at"):
            clean_data["updated_at"] = datetime.fromisoformat(clean_data["updated_at"])
        return SubscriptionModel(**clean_data)

    async def _invalidate_cache(
        self,
        tenant_id: str,
        sub_id: Optional[str] = None,
        preapproval_id: Optional[str] = None,
    ) -> None:
        if not redis_cache.redis_client:
            return

        keys_to_delete: List[str] = []
        if sub_id:
            keys_to_delete.append(self._get_cache_key_id(tenant_id, sub_id))
        if preapproval_id:
            keys_to_delete.append(self._get_cache_key_ext(tenant_id, preapproval_id))

        if keys_to_delete:
            try:
                await redis_cache.redis_client.delete(*keys_to_delete)
                logger.info(f"[SubscriptionsRepository] Cache invalidado no Redis: {keys_to_delete}")
            except Exception as err:
                logger.warning(f"[SubscriptionsRepository] Falha ao invalidar cache no Redis: {err}")

    async def create(self, subscription: SubscriptionModel) -> SubscriptionModel:
        session, owned = await self._get_session()
        try:
            session.add(subscription)
            await session.commit()
            await session.refresh(subscription)
        except Exception as e:
            if owned:
                await session.rollback()
            logger.error(f"[SubscriptionsRepository] Erro ao criar assinatura '{subscription.id}': {e}")
            raise
        finally:
            if owned:
                await session.close()

        await self._invalidate_cache(
            tenant_id=subscription.tenant_id,
            sub_id=subscription.id,
            preapproval_id=subscription.preapproval_id,
        )

        return subscription

    async def update(
        self,
        tenant_id: str,
        subscription_id: str,
        update_data: Dict[str, Any],
    ) -> Optional[SubscriptionModel]:
        session, owned = await self._get_session()
        try:
            stmt = select(SubscriptionModel).where(
                SubscriptionModel.tenant_id == tenant_id,
                SubscriptionModel.id == subscription_id,
            )
            result = await session.execute(stmt)
            subscription = result.scalar_one_or_none()

            if not subscription:
                return None

            old_preapproval_id = subscription.preapproval_id

            for field, value in update_data.items():
                if hasattr(subscription, field) and value is not None:
                    setattr(subscription, field, value)

            subscription.updated_at = datetime.now(timezone.utc)

            await session.commit()
            await session.refresh(subscription)
        except Exception as e:
            if owned:
                await session.rollback()
            logger.error(f"[SubscriptionsRepository] Erro ao atualizar assinatura '{subscription_id}': {e}")
            raise
        finally:
            if owned:
                await session.close()

        await self._invalidate_cache(
            tenant_id=tenant_id,
            sub_id=subscription.id,
            preapproval_id=subscription.preapproval_id,
        )
        if old_preapproval_id and old_preapproval_id != subscription.preapproval_id:
            await self._invalidate_cache(tenant_id=tenant_id, preapproval_id=old_preapproval_id)

        return subscription

    async def delete(self, tenant_id: str, subscription_id: str) -> bool:
        session, owned = await self._get_session()
        try:
            stmt = select(SubscriptionModel).where(
                SubscriptionModel.tenant_id == tenant_id,
                SubscriptionModel.id == subscription_id,
            )
            result = await session.execute(stmt)
            subscription = result.scalar_one_or_none()

            if not subscription:
                return False

            preapproval_id = subscription.preapproval_id

            await session.delete(subscription)
            await session.commit()
        except Exception as e:
            if owned:
                await session.rollback()
            logger.error(f"[SubscriptionsRepository] Erro ao deletar assinatura '{subscription_id}': {e}")
            raise
        finally:
            if owned:
                await session.close()

        await self._invalidate_cache(
            tenant_id=tenant_id,
            sub_id=subscription_id,
            preapproval_id=preapproval_id,
        )

        return True

    async def get_by_id(self, tenant_id: str, subscription_id: str) -> Optional[SubscriptionModel]:
        cache_key = self._get_cache_key_id(tenant_id, subscription_id)

        cached_data = await redis_cache.get(cache_key)
        if cached_data and isinstance(cached_data, dict):
            logger.debug(f"[SubscriptionsRepository] Cache HIT para {cache_key}")
            return self._dict_to_model(cached_data)

        logger.debug(f"[SubscriptionsRepository] Cache MISS para {cache_key}. Consultando Postgres...")
        session, owned = await self._get_session()
        try:
            stmt = select(SubscriptionModel).where(
                SubscriptionModel.tenant_id == tenant_id,
                SubscriptionModel.id == subscription_id,
            )
            result = await session.execute(stmt)
            subscription = result.scalar_one_or_none()
        finally:
            if owned:
                await session.close()

        if subscription:
            dict_data = self._model_to_dict(subscription)
            await redis_cache.set(cache_key, dict_data, expire_seconds=3600)
            ext_key = self._get_cache_key_ext(tenant_id, subscription.preapproval_id)
            await redis_cache.set(ext_key, dict_data, expire_seconds=3600)

        return subscription

    async def get_by_preapproval_id(self, tenant_id: str, preapproval_id: str) -> Optional[SubscriptionModel]:
        cache_key = self._get_cache_key_ext(tenant_id, preapproval_id)

        cached_data = await redis_cache.get(cache_key)
        if cached_data and isinstance(cached_data, dict):
            logger.debug(f"[SubscriptionsRepository] Cache HIT para {cache_key}")
            return self._dict_to_model(cached_data)

        logger.debug(f"[SubscriptionsRepository] Cache MISS para {cache_key}. Consultando Postgres...")
        session, owned = await self._get_session()
        try:
            stmt = select(SubscriptionModel).where(
                SubscriptionModel.tenant_id == tenant_id,
                SubscriptionModel.preapproval_id == preapproval_id,
            )
            result = await session.execute(stmt)
            subscription = result.scalar_one_or_none()
        finally:
            if owned:
                await session.close()

        if subscription:
            dict_data = self._model_to_dict(subscription)
            await redis_cache.set(cache_key, dict_data, expire_seconds=3600)
            id_key = self._get_cache_key_id(tenant_id, subscription.id)
            await redis_cache.set(id_key, dict_data, expire_seconds=3600)

        return subscription

    async def search(
        self,
        tenant_id: str,
        skip: int = 0,
        limit: int = 10,
        status: Optional[str] = None,
        payer_email: Optional[str] = None,
        plan_id: Optional[str] = None,
    ) -> Tuple[List[SubscriptionModel], int]:
        session, owned = await self._get_session()
        try:
            stmt = select(SubscriptionModel).where(SubscriptionModel.tenant_id == tenant_id)

            if status:
                stmt = stmt.where(SubscriptionModel.status == status)
            if payer_email:
                stmt = stmt.where(SubscriptionModel.payer_email == payer_email)
            if plan_id:
                stmt = stmt.where(SubscriptionModel.plan_id == plan_id)

            count_stmt = select(func.count()).select_from(stmt.subquery())
            total_result = await session.execute(count_stmt)
            total = total_result.scalar_one()

            stmt = stmt.order_by(SubscriptionModel.created_at.desc()).offset(skip).limit(limit)
            result = await session.execute(stmt)
            subscriptions = list(result.scalars().all())

            return subscriptions, total
        finally:
            if owned:
                await session.close()
