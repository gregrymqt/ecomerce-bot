from typing import Dict, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse

from app.features.shopify.services import ShopifyService, ShopifyWebhookService
from app.core.security.auth import get_current_tenant_user, sanitize_tenant_id
from app.features.auth.schemas import AuthenticatedUser
from app.features.shopify.schemas import (
    ShopifyMediaAddRequest,
    ShopifyProductResponse,
    ShopifyProductUpdateInput,
    ShopifySyncRequest,
)

router = APIRouter(
    prefix="/shopify",
    tags=["Shopify GraphQL Integration"],
)


def get_shopify_webhook_service() -> ShopifyWebhookService:
    return ShopifyWebhookService()


@router.post(
    "/webhooks",
    status_code=status.HTTP_200_OK,
    summary="Receptor de Webhooks da Shopify com Validação HMAC-SHA256",
)
async def shopify_webhook(
    request: Request,
    x_shopify_hmac: Optional[str] = Header(None, alias="X-Shopify-Hmac-Sha256"),
    x_shopify_webhook_id: Optional[str] = Header(None, alias="X-Shopify-Webhook-Id"),
    x_shopify_shop_domain: Optional[str] = Header(None, alias="X-Shopify-Shop-Domain"),
    x_shopify_topic: Optional[str] = Header(None, alias="X-Shopify-Topic"),
    webhook_service: ShopifyWebhookService = Depends(get_shopify_webhook_service),
) -> JSONResponse:
    """
    Recebe, valida e enfileira webhooks enviados pelo Shopify.
    Delega a validação HMAC, verificação de idempotência no Redis e enfileiramento ao ShopifyWebhookService.
    """
    raw_body = await request.body()
    result = await webhook_service.process_incoming_webhook(
        raw_body=raw_body,
        hmac_header=x_shopify_hmac,
        webhook_id=x_shopify_webhook_id,
        shop_domain=x_shopify_shop_domain,
        topic=x_shopify_topic,
    )
    return JSONResponse(status_code=status.HTTP_200_OK, content=result)




def get_shopify_service(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
) -> ShopifyService:
    """
    Fábrica de serviço que valida se o X-Tenant-ID do header está
    explicitamente autorizado nas claims do token JWT do usuário.
    """
    clean_tenant = sanitize_tenant_id(x_tenant_id)
    if clean_tenant not in current_user.tenants:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado ao tenant especificado.",
        )
    return ShopifyService(tenant_id=clean_tenant)

@router.post("/products", status_code=status.HTTP_201_CREATED, response_model=ShopifyProductResponse)
async def sync_product_to_shopify(
    product_data: ShopifySyncRequest,
    service: ShopifyService = Depends(get_shopify_service)
):
    return await service.sync_product(product_data.model_dump())

@router.post("/products/{product_id}/media", status_code=status.HTTP_201_CREATED, response_model=ShopifyProductResponse)
async def add_media_to_product(
    product_id: str,
    media_payload: ShopifyMediaAddRequest,
    service: ShopifyService = Depends(get_shopify_service)
):
    return await service.add_media_to_product(product_id, media_payload)

@router.put("/products/{product_id}", response_model=ShopifyProductResponse)
async def update_shopify_product(
    product_id: str,
    update_payload: ShopifyProductUpdateInput,
    service: ShopifyService = Depends(get_shopify_service)
):
    return await service.update_product(product_id, update_payload.model_dump(exclude_none=True))

@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shopify_product(
    product_id: str,
    service: ShopifyService = Depends(get_shopify_service)
):
    return await service.delete_product(product_id)

@router.get("/products", response_model=ShopifyProductResponse)
async def list_shopify_products(
    first: int = 10,
    after: str | None = None,
    service: ShopifyService = Depends(get_shopify_service)
):
    return await service.list_products(first=first, after=after)
