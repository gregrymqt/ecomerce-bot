import logging
from typing import Dict, Any, Optional
from fastapi import HTTPException, status
from fastapi.responses import JSONResponse

from app.features.shopify.client import ShopifyClient
from app.features.shopify.schemas import ShopifyProductSetInput
from app.features.products.repositories import TenantConfigRepository
from app.core.shared.csv_exporter import CsvExportService

logger = logging.getLogger(__name__)

class ShopifyService:
    """
    Serviço de Lógica de Negócio para o Shopify.
    Consome o TenantConfigRepository (para dados do banco) e o ShopifyClient (para a API).
    """
    def __init__(self, tenant_id: str, tenant_repo: TenantConfigRepository = None, client: ShopifyClient = None):
        self.tenant_id = tenant_id
        self.tenant_repo = tenant_repo or TenantConfigRepository()
        self.client = client

    async def _ensure_client(self) -> ShopifyClient:
        if self.client:
            return self.client
        creds = await self.tenant_repo.get_shopify_credentials(self.tenant_id)
        if not creds:
            raise HTTPException(
                status_code=status.HTTP_412_PRECONDITION_FAILED,
                detail=f"Credenciais do Shopify não configuradas para o Tenant '{self.tenant_id}'."
            )
        shop_domain, access_token = creds
        self.client = ShopifyClient(shop_domain=shop_domain, access_token=access_token)
        return self.client

    async def sync_product(self, product_data: Dict[str, Any]) -> Dict[str, Any]:
        client = await self._ensure_client()
        try:
            return await client.sync_product(product_data)
        except ValueError as val_err:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(val_err)
            )
        except Exception as e:
            try:
                input_data = ShopifyProductSetInput.from_internal_data(product_data)
                CsvExportService.generate_shopify_csv([input_data])
                download_url = "/api/v1/export?platform=shopify"
                
                return JSONResponse(
                    status_code=status.HTTP_202_ACCEPTED,
                    content={
                        "status": "fallback_csv",
                        "message": "A sincronização direta falhou temporariamente. O download do CSV com copywriting IA foi gerado como alternativa.",
                        "download_url": download_url
                    }
                )
            except Exception as fallback_err:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Falha na execução da mutação no provedor Shopify: {str(e)} | Erro no Fallback de CSV: {str(fallback_err)}"
                )

    async def add_media_to_product(self, product_id: str, media_payload: Dict[str, Any]) -> dict:
        client = await self._ensure_client()
        urls = media_payload.get("image_urls", [])
        alt = media_payload.get("alt_text")
        if not urls:
            raise HTTPException(status_code=400, detail="A lista 'image_urls' não pode estar vazia.")
            
        try:
            return await client.create_product_media(product_id=product_id, image_urls=urls, alt_text=alt)
        except ValueError as val_err:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(val_err))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    async def update_product(self, product_id: str, update_payload: Dict[str, Any]) -> dict:
        client = await self._ensure_client()
        try:
            new_images = update_payload.pop("new_images", None)
            return await client.update_product(
                product_id=product_id, 
                update_fields=update_payload, 
                new_images=new_images
            )
        except ValueError as val_err:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(val_err))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Erro update Shopify: {str(e)}")

    async def delete_product(self, product_id: str) -> None:
        client = await self._ensure_client()
        try:
            await client.delete_product(product_id=product_id)
            return None
        except ValueError as val_err:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Erro exclusão Shopify: {str(e)}")

    async def list_products(self, first: int = 10, after: Optional[str] = None) -> dict:
        client = await self._ensure_client()
        try:
            return await client.list_products(first=first, after=after)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Erro listagem Shopify: {str(e)}")
