from datetime import datetime, timezone
import logging
from typing import Optional, List
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.redis_db import redis_cache
from app.features.checkout.domain.enums import OrderStatus, OrderStatusDetail
from app.features.checkout.domain.models import OrderModel

logger = logging.getLogger(__name__)


class OrderRepository:
    """
    Repositório de dados para Checkout Orders.
    Implementa isolamento estrito por Tenant e estratégia de Caching via Redis.
    """

    CACHE_TTL_SECONDS = 1800  # 30 minutos

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        self.session = session

    # ==========================================
    # HELPER DE EXPIRAÇÃO DINÂMICA DE PIX
    # ==========================================

    async def _check_and_expire_pix(self, order: Optional[OrderModel]) -> Optional[OrderModel]:
        """
        Verifica se um pedido com pagamento PIX ultrapassou a data de expiração
        e o atualiza dinamicamente para CANCELED no banco e no cache Redis.
        """
        if not order or not order.pix_expiration_date:
            return order

        if order.status in {OrderStatus.CREATED, OrderStatus.PROCESSING, OrderStatus.ACTION_REQUIRED}:
            now_utc = datetime.now(timezone.utc)
            expiration_utc = order.pix_expiration_date
            if expiration_utc.tzinfo is None:
                expiration_utc = expiration_utc.replace(tzinfo=timezone.utc)

            if now_utc > expiration_utc:
                logger.info(
                    f"[OrderRepository] Pedido PIX '{order.id}' expirou (Data: {expiration_utc}). Atualizando status para CANCELED."
                )
                order.status = OrderStatus.CANCELED
                order.status_detail = None
                order.updated_at = now_utc

                if self.session:
                    await self.session.flush()
                    await self.session.commit()
                await self._refresh_cache(order)

        return order

    # ==========================================
    # CHAVES DE CACHE (MULTI-TENANT SAFE)
    # ==========================================

    @staticmethod
    def _cache_key_by_id(tenant_id: str, order_id: str) -> str:
        return f"checkout:order:{tenant_id}:{order_id}"

    @staticmethod
    def _cache_key_by_ref(tenant_id: str, external_ref: str) -> str:
        return f"checkout:order:ref:{tenant_id}:{external_ref}"

    @staticmethod
    def _cache_key_by_mp_id(tenant_id: str, mp_order_id: str) -> str:
        return f"checkout:order:mp:{tenant_id}:{mp_order_id}"

    # ==========================================
    # CONSULTAS (GET COM CACHE-ASIDE)
    # ==========================================

    async def get_by_id(self, tenant_id: str, order_id: str) -> Optional[OrderModel]:
        """Busca um pedido pelo ID interno da aplicação com verificação prévia no Cache."""
        cache_key = self._cache_key_by_id(tenant_id, order_id)
        
        # 1. Tenta recuperar do Redis
        cached_data = await redis_cache.get(cache_key)
        if isinstance(cached_data, dict):
            logger.debug(f"[OrderRepository] Cache HIT para ID: {order_id}")
            order = OrderModel(**cached_data)
            return await self._check_and_expire_pix(order)

        # 2. Busca no PostgreSQL filtrando estritamente pelo tenant_id
        logger.debug(f"[OrderRepository] Cache MISS para ID: {order_id}. Consultando DB...")
        stmt = select(OrderModel).where(
            OrderModel.tenant_id == tenant_id,
            OrderModel.id == order_id
        )
        result = await self.session.execute(stmt)
        order = result.scalars().first()

        # 3. Salva no Redis se encontrado
        if order:
            await redis_cache.set(cache_key, order.to_dict(), expire_seconds=self.CACHE_TTL_SECONDS)

        return await self._check_and_expire_pix(order)

    async def get_by_external_reference(self, tenant_id: str, external_ref: str) -> Optional[OrderModel]:
        """Busca um pedido pela referência externa (ID do pedido do tenant) com Cache."""
        cache_key = self._cache_key_by_ref(tenant_id, external_ref)

        cached_data = await redis_cache.get(cache_key)
        if isinstance(cached_data, dict):
            logger.debug(f"[OrderRepository] Cache HIT para ExternalRef: {external_ref}")
            order = OrderModel(**cached_data)
            return await self._check_and_expire_pix(order)

        stmt = select(OrderModel).where(
            OrderModel.tenant_id == tenant_id,
            OrderModel.external_reference == external_ref
        )
        result = await self.session.execute(stmt)
        order = result.scalars().first()

        if order:
            await redis_cache.set(cache_key, order.to_dict(), expire_seconds=self.CACHE_TTL_SECONDS)

        return await self._check_and_expire_pix(order)

    async def get_by_mp_order_id(self, tenant_id: str, mp_order_id: str) -> Optional[OrderModel]:
        """Busca um pedido pelo ID do Mercado Pago (útil no tratamento de Webhooks)."""
        cache_key = self._cache_key_by_mp_id(tenant_id, mp_order_id)

        cached_data = await redis_cache.get(cache_key)
        if isinstance(cached_data, dict):
            logger.debug(f"[OrderRepository] Cache HIT para MP_Order_ID: {mp_order_id}")
            order = OrderModel(**cached_data)
            return await self._check_and_expire_pix(order)

        stmt = select(OrderModel).where(
            OrderModel.tenant_id == tenant_id,
            OrderModel.mp_order_id == mp_order_id
        )
        result = await self.session.execute(stmt)
        order = result.scalars().first()

        if order:
            await redis_cache.set(cache_key, order.to_dict(), expire_seconds=self.CACHE_TTL_SECONDS)

        return await self._check_and_expire_pix(order)

    # ==========================================
    # MUTAÇÕES (CRUDS COM INVALIDAÇÃO DE CACHE)
    # ==========================================

    async def save(self, order: OrderModel) -> OrderModel:
        """Persiste um novo pedido e popula as chaves de cache correspondentes."""
        self.session.add(order)
        await self.session.flush()

        # Atualiza/Popula Caches no Redis
        await self._refresh_cache(order)
        return order

    async def update(self, order: OrderModel) -> OrderModel:
        """Atualiza a entidade no banco de dados e invalida/atualiza o cache."""
        await self.session.flush()

        # Invalida/Atualiza chaves afetadas
        await self._refresh_cache(order)
        return order

    async def delete_by_id(self, tenant_id: str, order_id: str) -> bool:
        """Remove o pedido do banco de dados e purga o cache do Redis."""
        order = await self.get_by_id(tenant_id, order_id)
        if not order:
            return False

        stmt = delete(OrderModel).where(
            OrderModel.tenant_id == tenant_id,
            OrderModel.id == order_id
        )
        await self.session.execute(stmt)

        # Invalida chaves do Redis
        await self._invalidate_cache(order)
        return True

    # ==========================================
    # HELPERS PRIVADOS DE CACHE
    # ==========================================

    async def _refresh_cache(self, order: OrderModel) -> None:
        """Armazena/Atualiza a entidade atualizada em todas as suas visões de cache."""
        data = order.to_dict()
        
        # Invalida/Grava no Redis
        await redis_cache.set(self._cache_key_by_id(order.tenant_id, order.id), data, self.CACHE_TTL_SECONDS)
        await redis_cache.set(self._cache_key_by_ref(order.tenant_id, order.external_reference), data, self.CACHE_TTL_SECONDS)
        
        if order.mp_order_id:
            await redis_cache.set(self._cache_key_by_mp_id(order.tenant_id, order.mp_order_id), data, self.CACHE_TTL_SECONDS)

    async def _invalidate_cache(self, order: OrderModel) -> None:
        """Remove explicitamente as chaves relativas ao pedido no Redis."""
        if not redis_cache.redis_client:
            return

        keys = [
            self._cache_key_by_id(order.tenant_id, order.id),
            self._cache_key_by_ref(order.tenant_id, order.external_reference),
        ]
        if order.mp_order_id:
            keys.append(self._cache_key_by_mp_id(order.tenant_id, order.mp_order_id))

        for key in keys:
            try:
                await redis_cache.redis_client.delete(key)
            except Exception as e:
                logger.warning(f"Falha ao invalidar chave de cache {key}: {e}")