import logging
from typing import List, Optional
from fastapi import HTTPException, status
from fastapi.responses import JSONResponse

from app.core.shared.csv_exporter import CsvExportService
from app.features.nuvemshop.infrastructure.client import NuvemshopClient
from app.features.nuvemshop.repositories import NuvemshopRepository
from app.features.products.repositories.product_repository import ProductRepository
from app.features.nuvemshop.schemas import NuvemshopProductRequest

logger = logging.getLogger(__name__)


class NuvemshopService:
    """
    Serviço de Lógica de Negócio para a Nuvemshop.
    Consome o NuvemshopRepository (para credenciais) e o NuvemshopClient (para a API REST).
    """

    def __init__(
        self,
        tenant_id: str,
        nuvemshop_repo: Optional[NuvemshopRepository] = None,
        product_repo: Optional[ProductRepository] = None,
        client: Optional[NuvemshopClient] = None,
    ):
        self.tenant_id = tenant_id
        self.nuvemshop_repo = nuvemshop_repo or NuvemshopRepository()
        self.product_repo = product_repo or ProductRepository()
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

        is_valid_scope = await client.validate_scopes()
        if not is_valid_scope:
            from app.features.emails.services.email_dispatcher import email_dispatcher
            await email_dispatcher.publish_email_event(
                event_name="EXTERNAL_CREDENTIAL_ERROR",
                recipient_email=f"admin@{self.tenant_id}.com",
                tenant_id=self.tenant_id,
                data={
                    "platform": "Nuvemshop",
                    "error_detail": "O token fornecido não possui permissões de escrita (write_products) na Nuvemshop.",
                },
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="O token fornecido não possui permissões de escrita (write_products) na Nuvemshop.",
            )

        self.client = client
        return self.client

    async def create_product(self, product: NuvemshopProductRequest) -> dict:
        client = await self._ensure_client()
        sku = product.variants[0].sku if product.variants and len(product.variants) > 0 else None

        try:
            # Verifica se já existe mapeamento no banco de dados para este SKU
            existing_product = await self.product_repo.get_by_tenant_and_sku(self.tenant_id, sku) if sku else None

            if existing_product and existing_product.nuvemshop_product_id:
                # Atualiza metadados do produto existente na Nuvemshop
                product_id_int = int(existing_product.nuvemshop_product_id)
                update_payload = product.model_dump(by_alias=True, exclude_none=True)
                result = await client.update_product_metadata(product_id_int, update_payload)
                nuvemshop_id = existing_product.nuvemshop_product_id
            else:
                # Cria produto novo na Nuvemshop via REST API
                result = await client.create_product(product)
                nuvemshop_id = result.get("id")

            # Mapeamento explícito de chave estrangeira no banco de dados
            if sku and nuvemshop_id:
                await self.product_repo.update_external_ids(
                    tenant_id=self.tenant_id,
                    sku=sku,
                    nuvemshop_product_id=str(nuvemshop_id),
                )

            return result
        except Exception as e:
            try:
                error_msg = str(e)
                CsvExportService.generate_nuvemshop_csv([product])
                download_url = "/api/v1/export?platform=nuvemshop"

                return JSONResponse(
                    status_code=status.HTTP_202_ACCEPTED,
                    content={
                        "status": "fallback_csv",
                        "message": "A sincronização direta falhou. O download do CSV com copywriting IA foi gerado como alternativa.",
                        "reason": error_msg,
                        "error_detail": f"Falha de comunicação Nuvemshop: {error_msg}",
                        "download_url": download_url,
                    },
                )
            except Exception as fallback_err:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Falha de comunicação com o provedor Nuvemshop: {str(e)} | Erro no Fallback: {str(fallback_err)}",
                )

    async def get_product_by_id(self, product_id: int) -> dict:
        client = await self._ensure_client()
        try:
            return await client.get_product_by_id(product_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Produto com o ID {product_id} não foi encontrado na Nuvemshop.",
            )

    async def get_product_by_sku(self, sku: str) -> dict:
        client = await self._ensure_client()
        product = await client.get_product_by_sku(sku)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Nenhum produto correspondente ao SKU '{sku}' foi encontrado.",
            )
        return product

    async def update_product_metadata(self, product_id: int, update_data: dict) -> dict:
        client = await self._ensure_client()
        try:
            return await client.update_product_metadata(product_id, update_data)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Incapaz de atualizar o produto {product_id}. Verifique o payload. Erro: {str(e)}",
            )

    async def update_stock_price_batch(self, batch_data: List[dict]) -> List[dict]:
        client = await self._ensure_client()
        try:
            return await client.update_stock_price_batch(batch_data)
        except ValueError as val_err:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(val_err))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    async def delete_product(self, product_id: int) -> None:
        client = await self._ensure_client()
        try:
            await client.delete_product(product_id)
            return None
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Erro ao tentar remover o produto {product_id}.",
            )
