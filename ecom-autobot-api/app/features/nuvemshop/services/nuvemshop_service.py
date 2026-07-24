import logging
from typing import List, Optional
from fastapi import HTTPException, status
from fastapi.responses import JSONResponse

from app.core.shared.csv_exporter import CsvExportService
from app.features.nuvemshop.infrastructure.client import NuvemshopClient
from app.features.nuvemshop.schemas import NuvemshopProductRequest
from app.features.products.repositories import TenantConfigRepository

logger = logging.getLogger(__name__)


class NuvemshopService:
    """
    Serviço de Lógica de Negócio para a Nuvemshop.
    Consome o TenantConfigRepository (para dados do banco) e o NuvemshopClient (para a API REST).
    """

    def __init__(
        self,
        tenant_id: str,
        tenant_repo: Optional[TenantConfigRepository] = None,
        client: Optional[NuvemshopClient] = None,
    ):
        self.tenant_id = tenant_id
        self.tenant_repo = tenant_repo or TenantConfigRepository()
        self.client = client

    async def _ensure_client(self) -> NuvemshopClient:
        if self.client:
            return self.client
        creds = await self.tenant_repo.get_nuvemshop_credentials(self.tenant_id)
        if not creds:
            raise HTTPException(
                status_code=status.HTTP_412_PRECONDITION_FAILED,
                detail=f"Credenciais da Nuvemshop não configuradas ou ausentes para o Tenant '{self.tenant_id}'.",
            )
        store_id, access_token, app_email = creds
        client = NuvemshopClient(store_id=store_id, access_token=access_token, app_email=app_email)

        is_valid_scope = await client.validate_scopes()
        if not is_valid_scope:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="O token fornecido não possui permissões de escrita (write_products) na Nuvemshop.",
            )

        self.client = client
        return self.client

    async def create_product(self, product: NuvemshopProductRequest) -> dict:
        client = await self._ensure_client()
        try:
            return await client.create_product(product)
        except Exception as e:
            try:
                CsvExportService.generate_nuvemshop_csv([product])
                download_url = "/api/v1/export?platform=nuvemshop"

                return JSONResponse(
                    status_code=status.HTTP_202_ACCEPTED,
                    content={
                        "status": "fallback_csv",
                        "message": "A sincronização direta falhou temporariamente. O download do CSV com copywriting IA foi gerado como alternativa.",
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
