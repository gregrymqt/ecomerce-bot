from typing import List
from datetime import datetime, timezone
import logging
from typing import Any, Dict, Optional, Tuple
import uuid

from sqlalchemy import select, update, delete, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select as future_select

from app.core.config.database import AsyncSessionLocal
from app.core.config.redis_db import redis_cache
from app.features.products.domain.models import ProductModel
from app.features.products.schemas import Product

logger = logging.getLogger(__name__)


class ProductRepository:
    """
    Repositório assíncrono para a tabela de Produtos com Cache-Aside e invalidação Redis.
    """

    CACHE_TTL = 3600  # 1 hora em segundos

    def __init__(self, session: Optional[AsyncSession] = None):
        self.session = session

    async def _get_session(self) -> Tuple[AsyncSession, bool]:
        if self.session is not None:
            return self.session, False
        session = AsyncSessionLocal()
        return session, True

    def _to_model(self, product: Product) -> ProductModel:
        payload = product.model_dump(by_alias=True, mode="json")
        return ProductModel(
            id=product.id or str(uuid.uuid4()),
            tenant_id=product.tenant_id,
            sku=product.sku,
            title=product.title or "",
            status=product.status.value if hasattr(product.status, "value") else str(product.status),
            raw_payload=payload,
            ai_enriched_data=getattr(product, "ai_enriched_data", None),
        )

    def _model_to_dict(self, model: ProductModel) -> Dict[str, Any]:
        """Converte um ProductModel para dicionário serializável em JSON."""
        return {
            "id": model.id,
            "tenant_id": model.tenant_id,
            "sku": model.sku,
            "title": model.title,
            "status": model.status,
            "raw_payload": model.raw_payload,
            "ai_enriched_data": model.ai_enriched_data,
            "created_at": model.created_at.isoformat() if hasattr(model, "created_at") and model.created_at else None,
            "updated_at": model.updated_at.isoformat() if hasattr(model, "updated_at") and model.updated_at else None,
        }

    def _dict_to_model(self, data: Dict[str, Any]) -> ProductModel:
        """Reconstrói um ProductModel a partir de dicionário recuperado do cache."""
        return ProductModel(
            id=data["id"],
            tenant_id=data["tenant_id"],
            sku=data["sku"],
            title=data.get("title", ""),
            status=data.get("status", "RAW"),
            raw_payload=data.get("raw_payload", {}),
            ai_enriched_data=data.get("ai_enriched_data"),
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

    async def _invalidate_product_cache(self, tenant_id: str, sku: str) -> None:
        """Invalida o cache individual do produto no Redis."""
        try:
            if redis_cache.redis_client:
                await redis_cache.redis_client.delete(f"product:{tenant_id}:{sku}")
                logger.info(f"[ProductRepository] Cache do produto '{tenant_id}:{sku}' invalidado com sucesso.")
        except Exception as err:
            logger.warning(f"[ProductRepository] Falha ao invalidar cache do produto '{tenant_id}:{sku}': {err}")

    async def upsert_product(self, product: Product) -> bool:
        session, owned = await self._get_session()
        try:
            try:
                existing = await session.get(
                    ProductModel,
                    product.id or "",
                )
            except Exception:
                existing = None

            if existing is None:
                stmt = select(ProductModel).where(
                    ProductModel.tenant_id == product.tenant_id,
                    ProductModel.sku == product.sku,
                )
                result = await session.execute(stmt)
                existing = result.scalar_one_or_none()

            model = self._to_model(product)

            if existing is None:
                session.add(model)
                await session.commit()
            else:
                existing.tenant_id = model.tenant_id
                existing.sku = model.sku
                existing.title = model.title
                existing.status = model.status
                existing.raw_payload = model.raw_payload
                existing.ai_enriched_data = model.ai_enriched_data
                await session.commit()

            # Invalida o cache do Redis após persistir no banco
            await self._invalidate_product_cache(product.tenant_id, product.sku)
            return True

        except Exception as e:
            logger.error(f"Erro ao persistir SKU {product.sku} para o Tenant {product.tenant_id}: {e}")
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()

    async def get_by_tenant_and_sku(self, tenant_id: str, sku: str) -> Optional[ProductModel]:
        """
        Busca produto por tenant_id e sku. Tenta do Redis via Cache-Aside;
        se não existir, faz a consulta no banco de dados e armazena em cache.
        """
        cache_key = f"product:{tenant_id}:{sku}"

        async def fetch_from_db() -> Optional[Dict[str, Any]]:
            logger.info(f"[ProductRepository] Cache Miss. Buscando produto '{tenant_id}:{sku}' no banco.")
            session, owned = await self._get_session()
            try:
                stmt = future_select(ProductModel).where(
                    ProductModel.tenant_id == tenant_id,
                    ProductModel.sku == sku,
                )
                result = await session.execute(stmt)
                model = result.scalar_one_or_none()
                return self._model_to_dict(model) if model else None
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

    async def set_status(self, tenant_id: str, sku: str, status: str) -> None:
        session, owned = await self._get_session()
        try:
            stmt = (
                update(ProductModel)
                .where(ProductModel.tenant_id == tenant_id, ProductModel.sku == sku)
                .values(status=status)
            )
            await session.execute(stmt)
            await session.commit()

            # Invalida o cache após atualizar o status
            await self._invalidate_product_cache(tenant_id, sku)
        except Exception:
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()


    # --- MÉTODOS DE CONSULTA E PAGINAÇÃO DO CATÁLOGO ---

    async def list_products(
        self,
        tenant_id: str,
        status: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 20
    ) -> Tuple[List[ProductModel], int]:
        """
        Busca paginada por tenant, permitindo filtro por status e busca por SKU ou Título.
        """
        session, owned = await self._get_session()
        try:
            # Query Base obrigatória por Tenant
            query = select(ProductModel).where(ProductModel.tenant_id == tenant_id)

            # Filtro opcional por Status (RAW, PROCESSING, PROCESSED, FAILED, EXPORTED)
            if status:
                query = query.where(ProductModel.status == status)

            # Filtro opcional de Busca Textual (por SKU ou Título)
            if search:
                search_term = f"%{search}%"
                query = query.where(
                    or_(
                        ProductModel.sku.ilike(search_term),
                        ProductModel.title.ilike(search_term)
                    )
                )

            # Contagem total de itens que satisfazem os filtros
            count_query = select(func.count()).select_from(query.subquery())
            total_result = await session.execute(count_query)
            total = total_result.scalar_one() or 0

            # Aplica paginação e ordenação (mais recentes primeiro)
            offset = (page - 1) * limit
            query = query.order_by(ProductModel.created_at.desc()).offset(offset).limit(limit)

            result = await session.execute(query)
            products = list(result.scalars().all())

            return products, total
        finally:
            if owned:
                await session.close()

    async def update_product_data(self, tenant_id: str, sku: str, update_data: dict) -> Optional[ProductModel]:
        """
        Atualiza campos específicos do produto e reflete as alterações no raw_payload.
        """
        session, owned = await self._get_session()
        try:
            stmt = select(ProductModel).where(
                ProductModel.tenant_id == tenant_id,
                ProductModel.sku == sku
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()

            if not model:
                return None

            # Atualiza payload JSONB interno
            current_payload = dict(model.raw_payload or {})
            for key, val in update_data.items():
                if val is not None:
                    current_payload[key] = val
                    if hasattr(model, key):
                        setattr(model, key, val)

            model.raw_payload = current_payload
            model.updated_at = datetime.now(timezone.utc)

            await session.commit()
            await self._invalidate_product_cache(tenant_id, sku)
            return model
        except Exception:
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()

    async def delete_product(self, tenant_id: str, sku: str) -> bool:
        """
        Remove um produto do banco e do cache Redis.
        """
        session, owned = await self._get_session()
        try:
            stmt = delete(ProductModel).where(
                ProductModel.tenant_id == tenant_id,
                ProductModel.sku == sku
            )
            result = await session.execute(stmt)
            await session.commit()

            if result.rowcount > 0:
                await self._invalidate_product_cache(tenant_id, sku)
                return True
            return False
        except Exception:
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()