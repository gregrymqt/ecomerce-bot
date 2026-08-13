import logging
from typing import List, Optional
from fastapi import HTTPException, status

from app.features.nuvemshop.infrastructure.client import NuvemshopClient
from app.features.nuvemshop.repositories import NuvemshopRepository
from app.features.nuvemshop.schemas import NuvemshopLocationResponse

logger = logging.getLogger(__name__)


class NuvemshopStockService:
    """
    Serviço de Lógica de Negócio para o Módulo de Estoque e Depósitos (Locations) da Nuvemshop.
    Consome o NuvemshopRepository (para credenciais BYOK) e o NuvemshopClient (para a API REST).
    """

    def __init__(
        self,
        tenant_id: str,
        nuvemshop_repo: Optional[NuvemshopRepository] = None,
        client: Optional[NuvemshopClient] = None,
    ):
        self.tenant_id = tenant_id
        self.nuvemshop_repo = nuvemshop_repo or NuvemshopRepository()
        self.client = client

    async def _ensure_client(self) -> NuvemshopClient:
        if self.client:
            return self.client

        creds = await self.nuvemshop_repo.get_credentials(self.tenant_id)
        if not creds:
            from app.features.emails.services.email_dispatcher import email_dispatcher
            await email_dispatcher.publish_email_event(
                event_name="EXTERNAL_CREDENTIAL_ERROR",
                recipient_email=f"admin@{self.tenant_id}.com",
                tenant_id=self.tenant_id,
                data={
                    "platform": "Nuvemshop",
                    "error_detail": f"Credenciais da Nuvemshop não configuradas para o Tenant '{self.tenant_id}'.",
                },
            )
            raise HTTPException(
                status_code=status.HTTP_412_PRECONDITION_FAILED,
                detail=f"Credenciais da Nuvemshop não configuradas ou ausentes para o Tenant '{self.tenant_id}'.",
            )

        client = NuvemshopClient(store_id=creds.store_id, access_token=creds.access_token, app_email=creds.app_email)

        is_valid_scope = await client.validate_scopes("read_locations")
        if not is_valid_scope:
            from app.features.emails.services.email_dispatcher import email_dispatcher
            await email_dispatcher.publish_email_event(
                event_name="EXTERNAL_CREDENTIAL_ERROR",
                recipient_email=f"admin@{self.tenant_id}.com",
                tenant_id=self.tenant_id,
                data={
                    "platform": "Nuvemshop",
                    "error_detail": "O token fornecido não possui permissão de leitura de depósitos (read_locations) na Nuvemshop.",
                },
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="O token fornecido não possui permissão de leitura de depósitos (read_locations) na Nuvemshop.",
            )

        self.client = client
        return self.client

    async def get_tenant_locations(self) -> List[NuvemshopLocationResponse]:
        """
        Retorna a lista de depósitos / localizações de estoque cadastradas na Nuvemshop para o tenant.
        """
        client = await self._ensure_client()
        try:
            return await client.get_locations()
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Erro ao obter localizações do tenant '{self.tenant_id}': {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Falha de comunicação ao consultar depósitos na Nuvemshop: {str(e)}",
            )

    async def get_default_location(self) -> Optional[NuvemshopLocationResponse]:
        """
        Retorna a localização/depósito padrão da loja do tenant na Nuvemshop.
        """
        client = await self._ensure_client()
        try:
            return await client.get_default_location()
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Erro ao obter localização padrão do tenant '{self.tenant_id}': {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Falha de comunicação ao consultar depósito padrão na Nuvemshop: {str(e)}",
            )
