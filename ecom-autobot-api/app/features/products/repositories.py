from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config.database import AsyncSessionLocal
import logging
from sqlalchemy import select, update
from sqlalchemy.future import select as future_select
from app.features.products.models import ProductModel, TenantConfigModel
from app.features.products.schemas import Product

class ProductRepository:
    def __init__(self, session: AsyncSession = None):
        self.session = session

    async def _get_session(self) -> tuple[AsyncSession,bool]:
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
                return True

            existing.tenant_id = model.tenant_id
            existing.sku = model.sku
            existing.title = model.title
            existing.status = model.status
            existing.raw_payload = model.raw_payload
            existing.ai_enriched_data = model.ai_enriched_data
            await session.commit()
            return True

        except Exception as e:
            logging.error(f"Erro ao persistir SKU {product.sku} para o Tenant {product.tenant_id}: {e}")
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()

    async def get_by_tenant_and_sku(self, tenant_id: str, sku: str) -> ProductModel | None:
        session, owned = await self._get_session()
        try:
            stmt = future_select(ProductModel).where(
                ProductModel.tenant_id == tenant_id,
                ProductModel.sku == sku,
            )
            result = await session.execute(stmt)
            return result.scalar_one_or_none()
        finally:
            if owned:
                await session.close()

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
        except Exception:
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()


class TenantConfigRepository:
    def __init__(self, session: AsyncSessionLocal = None):
        self.session = session

    async def _get_session(self) -> tuple[AsyncSession,bool]:
        if self.session is not None:
            return self.session, False
        session = AsyncSessionLocal()
        return session, True

    async def get(self, tenant_id: str) -> TenantConfigModel | None:
        session, owned = await self._get_session()
        try:
            stmt = select(TenantConfigModel).where(TenantConfigModel.tenant_id == tenant_id)
            result = await session.execute(stmt)
            return result.scalar_one_or_none()
        finally:
            if owned:
                await session.close()

    async def get_shopify_credentials(self, tenant_id: str) -> tuple[str, str] | None:
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

    async def get_nuvemshop_credentials(self, tenant_id: str) -> tuple[str, str, str] | None:
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
        except Exception:
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()
