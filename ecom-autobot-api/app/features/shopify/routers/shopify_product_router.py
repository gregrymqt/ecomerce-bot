from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.core.security.auth import get_current_tenant_user, sanitize_tenant_id
from app.features.auth.schemas import AuthenticatedUser
from app.features.shopify.schemas import (
    ShopifyMediaAddRequest,
    ShopifyProductResponse,
    ShopifyProductUpdateInput,
    ShopifyStatusUpdateInput,
    ShopifySyncRequest,
)
from app.features.shopify.services import ShopifyProductService

router = APIRouter(prefix="/shopify", tags=["Shopify GraphQL Integration"])


def get_shopify_product_service(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
) -> ShopifyProductService:
    clean_tenant = sanitize_tenant_id(x_tenant_id)
    if clean_tenant not in current_user.tenants:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado ao tenant especificado.",
        )
    return ShopifyProductService(tenant_id=clean_tenant)


@router.post("/products", status_code=status.HTTP_201_CREATED, response_model=ShopifyProductResponse)
async def sync_product_to_shopify(
    product_data: ShopifySyncRequest,
    service: ShopifyProductService = Depends(get_shopify_product_service),
):
    return await service.sync_product(product_data.model_dump())


@router.post("/products/{product_id}/media", status_code=status.HTTP_201_CREATED, response_model=ShopifyProductResponse)
async def add_media_to_product(
    product_id: str,
    media_payload: ShopifyMediaAddRequest,
    service: ShopifyProductService = Depends(get_shopify_product_service),
):
    return await service.add_media_to_product(product_id, media_payload)


@router.put("/products/{product_id}", response_model=ShopifyProductResponse)
async def update_shopify_product(
    product_id: str,
    update_payload: ShopifyProductUpdateInput,
    service: ShopifyProductService = Depends(get_shopify_product_service),
):
    return await service.update_product(product_id, update_payload.model_dump(exclude_none=True))


@router.patch("/products/{sku}/status", summary="Alteração de Status do Produto na Shopify")
async def update_shopify_status(
    sku: str,
    status_payload: ShopifyStatusUpdateInput,
    service: ShopifyProductService = Depends(get_shopify_product_service),
):
    return await service.change_product_status_by_sku(
        sku=sku,
        status_value=status_payload.status,
    )


@router.delete("/products/{sku}", status_code=status.HTTP_200_OK, summary="Exclusão Remota do Produto na Shopify")
async def delete_shopify_product_by_sku(
    sku: str,
    service: ShopifyProductService = Depends(get_shopify_product_service),
):
    return await service.delete_remote_product_by_sku(sku=sku)


@router.get("/products", response_model=ShopifyProductResponse)
async def list_shopify_products(
    first: int = 10,
    after: str | None = None,
    service: ShopifyProductService = Depends(get_shopify_product_service),
):
    return await service.list_products(first=first, after=after)
