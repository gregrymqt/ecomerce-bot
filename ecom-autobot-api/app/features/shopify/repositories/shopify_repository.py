import logging
from typing import Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security.crypto import encrypt_api_key
from app.features.products.domain.models import TenantConfigModel
from app.features.products.repositories.tenant_config_repository import TenantConfigRepository
from app.features.shopify.domain.entities import ShopifyCredentials

logger = logging.getLogger(__name__)


class ShopifyRepository:
    """
    Repositório de dados para recuperar e gerenciar credenciais e estado da integração Shopify.
    """

    def __init__(
        self,
        tenant_repo: Optional[TenantConfigRepository] = None,
        session: Optional[AsyncSession] = None,
    ):
        self.tenant_repo = tenant_repo or TenantConfigRepository(session=session)

    async def get_credentials(self, tenant_id: str) -> Optional[ShopifyCredentials]:
        """Recupera e descriptografa as credenciais do Shopify para o tenant especificado."""
        creds = await self.tenant_repo.get_shopify_credentials(tenant_id)
        if not creds:
            return None
        shop_domain, access_token = creds
        return ShopifyCredentials(shop_domain=shop_domain, access_token=access_token)

    async def save_integration(self, tenant_id: str, shop_domain: str, access_token: str) -> None:
        """
        Criptografa o access_token com AES-256 GCM e persiste a integração do Shopify para o tenant.
        """
        encrypted_token = encrypt_api_key(access_token)
        clean_domain = shop_domain.replace("https://", "").replace("http://", "").split("/")[0].strip().lower()

        config = await self.tenant_repo.get(tenant_id)
        current_keys = dict(config.encrypted_keys) if config and config.encrypted_keys else {}
        current_keys["shopify_shop_domain"] = clean_domain
        current_keys["shopify_access_token"] = encrypted_token

        await self.tenant_repo.upsert(tenant_id=tenant_id, encrypted_keys=current_keys)
        logger.info(f"[ShopifyRepository] Integração salva com sucesso para o Tenant '{tenant_id}' (Loja: {clean_domain}).")

    async def get_by_shop_domain(self, shop_domain: str) -> Optional[Tuple[str, ShopifyCredentials]]:
        """
        Busca a integração ativa pelo domínio do lojista (ex: 'loja.myshopify.com')
        e retorna uma tupla (tenant_id, ShopifyCredentials).
        """
        clean_domain = shop_domain.replace("https://", "").replace("http://", "").split("/")[0].strip().lower()
        session, owned = await self.tenant_repo._get_session()
        try:
            stmt = select(TenantConfigModel)
            result = await session.execute(stmt)
            configs = result.scalars().all()

            for cfg in configs:
                keys = cfg.encrypted_keys or {}
                domain = str(keys.get("shopify_shop_domain", "")).replace("https://", "").replace("http://", "").split("/")[0].strip().lower()
                if domain and domain == clean_domain:
                    creds = await self.get_credentials(cfg.tenant_id)
                    if creds:
                        return cfg.tenant_id, creds
            return None
        finally:
            if owned:
                await session.close()

    async def get_tenant_by_shop_domain(self, shop_domain: str) -> Optional[str]:
        """
        Retorna o tenant_id ativo associado ao domínio da loja Shopify (X-Shopify-Shop-Domain).
        """
        result = await self.get_by_shop_domain(shop_domain)
        if result:
            return result[0]
        return None

    async def deactivate_integration(self, shop_domain: str) -> bool:
        """
        Inativa a integração da Shopify para o domínio especificado (evento app/uninstalled).
        """
        result = await self.get_by_shop_domain(shop_domain)
        if not result:
            logger.warning(f"[ShopifyRepository] Tentativa de inativação para loja não encontrada: '{shop_domain}'.")
            return False
        tenant_id, _ = result
        config = await self.tenant_repo.get(tenant_id)
        current_keys = dict(config.encrypted_keys) if config and config.encrypted_keys else {}
        current_keys["shopify_is_active"] = False
        current_keys.pop("shopify_access_token", None)

        await self.tenant_repo.upsert(tenant_id=tenant_id, encrypted_keys=current_keys)
        logger.info(f"[ShopifyRepository] Integração inativada com sucesso para a loja '{shop_domain}' (Tenant: '{tenant_id}').")
        return True


