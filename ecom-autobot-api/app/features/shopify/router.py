from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Header, status

from app.features.shopify.service import ShopifyService
from app.core.security.auth import get_current_tenant_user

router = APIRouter(
    prefix="/shopify", 
    tags=["Shopify GraphQL Integration"],
    dependencies=[Depends(get_current_tenant_user)]
)

def get_shopify_service(x_tenant_id: str = Header(..., alias="X-Tenant-ID")) -> ShopifyService:
    return ShopifyService(tenant_id=x_tenant_id)

@router.post("/products", status_code=status.HTTP_201_CREATED, response_model=Dict[str, Any])
async def sync_product_to_shopify(
    product_data: Dict[str, Any], 
    service: ShopifyService = Depends(get_shopify_service)
):
    return await service.sync_product(product_data)

@router.post("/products/{product_id}/media", status_code=status.HTTP_201_CREATED)
async def add_media_to_product(
    product_id: str,
    media_payload: Dict[str, Any],
    service: ShopifyService = Depends(get_shopify_service)
):
    return await service.add_media_to_product(product_id, media_payload)

@router.put("/products/{product_id}", response_model=Dict[str, Any])
async def update_shopify_product(
    product_id: str,
    update_payload: Dict[str, Any],
    service: ShopifyService = Depends(get_shopify_service)
):
    return await service.update_product(product_id, update_payload)

@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shopify_product(
    product_id: str, 
    service: ShopifyService = Depends(get_shopify_service)
):
    return await service.delete_product(product_id)

@router.get("/products", response_model=Dict[str, Any])
async def list_shopify_products(
    first: int = 10,
    after: Optional[str] = None,
    service: ShopifyService = Depends(get_shopify_service)
):
    return await service.list_products(first=first, after=after)
