from datetime import datetime, timezone
import logging
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select as future_select

from app.core.config.database import AsyncSessionLocal
from app.core.config.redis_db import redis_cache
from app.features.products.models import ProductModel, TenantConfigModel
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
            id=product.id or str(__import__("uuid").uuid4()),
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

            if existing is None and product.id:
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


class TenantConfigRepository:
    """
    Repositório assíncrono para as configurações de Tenant (chaves API e tokens de e-commerce).
    Utiliza estratégia de Cache-Aside no Redis.
    """

    CACHE_TTL = 3600  # 1 hora em segundos

    def __init__(self, session: Optional[AsyncSession] = None):
        self.session = session

    async def _get_session(self) -> Tuple[AsyncSession, bool]:
        if self.session is not None:
            return self.session, False
        session = AsyncSessionLocal()
        return session, True

    def _model_to_dict(self, model: TenantConfigModel) -> Dict[str, Any]:
        """Converte TenantConfigModel para dicionário serializável em JSON."""
        return {
            "tenant_id": model.tenant_id,
            "encrypted_keys": model.encrypted_keys or {},
            "created_at": model.created_at.isoformat() if hasattr(model, "created_at") and model.created_at else None,
            "updated_at": model.updated_at.isoformat() if hasattr(model, "updated_at") and model.updated_at else None,
        }

    def _dict_to_model(self, data: Dict[str, Any]) -> TenantConfigModel:
        """Reconstrói um TenantConfigModel a partir de dicionário recuperado do cache."""
        return TenantConfigModel(
            tenant_id=data["tenant_id"],
            encrypted_keys=data.get("encrypted_keys", {}),
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

    async def _invalidate_tenant_config_cache(self, tenant_id: str) -> None:
        """Invalida o cache de configurações do tenant no Redis."""
        try:
            if redis_cache.redis_client:
                await redis_cache.redis_client.delete(f"tenant_config:{tenant_id}")
                logger.info(f"[TenantConfigRepository] Cache do tenant_config '{tenant_id}' invalidado com sucesso.")
        except Exception as err:
            logger.warning(f"[TenantConfigRepository] Falha ao invalidar cache do tenant_config '{tenant_id}': {err}")

    async def get(self, tenant_id: str) -> Optional[TenantConfigModel]:
        """
        Busca configurações do tenant por tenant_id. Tenta do Redis via Cache-Aside;
        se não existir, faz a consulta no banco de dados e armazena em cache.
        """
        cache_key = f"tenant_config:{tenant_id}"

        async def fetch_from_db() -> Optional[Dict[str, Any]]:
            logger.info(f"[TenantConfigRepository] Cache Miss. Buscando tenant_config '{tenant_id}' no banco.")
            session, owned = await self._get_session()
            try:
                stmt = select(TenantConfigModel).where(TenantConfigModel.tenant_id == tenant_id)
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

    async def get_shopify_credentials(self, tenant_id: str) -> Optional[Tuple[str, str]]:
        """
        Recupera e descriptografa as credenciais do Shopify para o tenant especificado.
        Retorna (shop_domain, decrypted_access_token) ou None se não configurado.
        """
        config = await self.get(tenant_id)
        if not config:
            return None
        tenant_keys = config.encrypted_keys or {}
        shop_domain = tenant_keys.get("shopify_shop_domain")
        raw_token = tenant_keys.get("shopify_access_token")
        if not shop_domain or not raw_token:
            return None
        from app.core.security.crypto import decrypt_api_key
        access_token = decrypt_api_key(raw_token)
        return str(shop_domain), access_token

    async def get_nuvemshop_credentials(self, tenant_id: str) -> Optional[Tuple[str, str, str]]:
        """
        Recupera e descriptografa as credenciais da Nuvemshop para o tenant especificado.
        Retorna (store_id, decrypted_access_token, app_email) ou None se não configurado.
        """
        config = await self.get(tenant_id)
        if not config:
            return None
        tenant_keys = config.encrypted_keys or {}
        store_id = tenant_keys.get("nuvemshop_store_id")
        raw_token = tenant_keys.get("nuvemshop_access_token")
        app_email = tenant_keys.get("email", "suporte@ecommerce-bot.com")
        if not store_id or not raw_token:
            return None
        from app.core.security.crypto import decrypt_api_key
        access_token = decrypt_api_key(raw_token)
        return str(store_id), access_token, str(app_email)

    async def upsert(self, tenant_id: str, encrypted_keys: dict) -> None:
        session, owned = await self._get_session()
        try:
            existing = await session.get(TenantConfigModel, tenant_id)
            if existing is None:
                session.add(TenantConfigModel(tenant_id=tenant_id, encrypted_keys=encrypted_keys))
            else:
                existing.encrypted_keys = encrypted_keys
            await session.commit()

            # Invalida o cache após salvar/atualizar credenciais
            await self._invalidate_tenant_config_cache(tenant_id)
        except Exception:
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()
