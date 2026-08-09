import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

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
