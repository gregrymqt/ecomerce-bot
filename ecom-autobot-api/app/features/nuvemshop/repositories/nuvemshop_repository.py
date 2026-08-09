import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.nuvemshop.domain.entities import NuvemshopCredentials
from app.features.products.repositories.tenant_config_repository import TenantConfigRepository

logger = logging.getLogger(__name__)


class NuvemshopRepository:
    """
    Repositório de dados para recuperar e gerenciar credenciais e estado da integração Nuvemshop.
    """

    def __init__(
        self,
        tenant_repo: Optional[TenantConfigRepository] = None,
        session: Optional[AsyncSession] = None,
    ):
        self.tenant_repo = tenant_repo or TenantConfigRepository(session=session)

    async def get_credentials(self, tenant_id: str) -> Optional[NuvemshopCredentials]:
        """Recupera e descriptografa as credenciais da Nuvemshop para o tenant especificado."""
        creds = await self.tenant_repo.get_nuvemshop_credentials(tenant_id)
        if not creds:
            return None
        store_id, access_token, app_email = creds
        return NuvemshopCredentials(store_id=store_id, access_token=access_token, app_email=app_email)
