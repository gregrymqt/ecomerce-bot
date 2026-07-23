import httpx
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header, status
from fastapi.responses import JSONResponse

from app.features.shopify.service import ShopifyService
from app.core.config.database import AsyncSessionLocal
from app.features.products.models import TenantConfigModel
from app.core.security.crypto import decrypt_api_key
from app.core.shared.csv_exporter import CsvExportService
from app.features.shopify.schemas import ShopifyProductSetInput
from app.core.security.auth import get_current_tenant_user

router = APIRouter(
    prefix="/shopify", 
    tags=["Shopify GraphQL Integration"],
    dependencies=[Depends(get_current_tenant_user)]
)

async def get_shopify_service(x_tenant_id: str = Header(..., alias="X-Tenant-ID")) -> ShopifyService:
    async with AsyncSessionLocal() as session:
        config = await session.get(TenantConfigModel, x_tenant_id)

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Tenant '{x_tenant_id}' não encontrado no ecossistema."
        )

    tenant = config.encrypted_keys or {}
    shop_domain = tenant.get("shopify_shop_domain")
    raw_token = tenant.get("shopify_access_token")

    if not shop_domain or not raw_token:
        raise HTTPException(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            detail="Credenciais do Shopify (Domínio ou Access Token) não configuradas para este Tenant."
        )

    access_token = decrypt_api_key(raw_token)
    return ShopifyService(shop_domain=str(shop_domain), access_token=access_token)

@router.post("/products", status_code=status.HTTP_201_CREATED, response_model=Dict[str, Any])
async def sync_product_to_shopify(
    product_data: Dict[str, Any], 
    service: ShopifyService = Depends(get_shopify_service)
):
    try:
        result = await service.sync_product(product_data)
        return result
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err)
        )
    except Exception as e:
        try:
            input_data = ShopifyProductSetInput.from_internal_data(product_data)
            csv_bytes = CsvExportService.generate_shopify_csv([input_data])
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

@router.post("/products/{product_id}/media", status_code=status.HTTP_201_CREATED)
async def add_media_to_product(
    product_id: str,
    media_payload: Dict[str, Any],
    service: ShopifyService = Depends(get_shopify_service)
):
    try:
        urls = media_payload.get("image_urls", [])
        alt = media_payload.get("alt_text")
        if not urls:
            raise HTTPException(status_code=400, detail="A lista 'image_urls' não pode estar vazia.")
            
        result = await service.create_product_media(product_id=product_id, image_urls=urls, alt_text=alt)
        return result
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(val_err))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))      

@router.put("/products/{product_id}", response_model=Dict[str, Any])
async def update_shopify_product(
    product_id: str,
    update_payload: Dict[str, Any],
    service: ShopifyService = Depends(get_shopify_service)
):
    try:
        new_images = update_payload.pop("new_images", None)
        result = await service.update_product(
            product_id=product_id, 
            update_fields=update_payload, 
            new_images=new_images
        )
        return result
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Incapaz de processar a atualização no Shopify GraphQL: {str(e)}"
        )

@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shopify_product(
    product_id: str, 
    service: ShopifyService = Depends(get_shopify_service)
):
    try:
        await service.delete_product(product_id=product_id)
        return None
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Falha de comunicação para exclusão de produto no Shopify: {str(e)}"
        )        

@router.get("/products", response_model=Dict[str, Any])
async def list_shopify_products(
    first: int = 10,
    after: Optional[str] = None,
    service: ShopifyService = Depends(get_shopify_service)
):
    try:
        result = await service.list_products(first=first, after=after)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Incapaz de recuperar a lista de produtos do provedor: {str(e)}"
        )
