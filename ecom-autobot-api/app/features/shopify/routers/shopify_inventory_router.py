from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.core.security.auth import get_current_tenant_user, sanitize_tenant_id
from app.features.auth.schemas import AuthenticatedUser
from app.features.shopify.schemas import ShopifyInventoryUpdateInput
from app.features.shopify.services import ShopifyInventoryService

router = APIRouter(prefix="/shopify", tags=["Shopify Inventory Integration"])


def get_shopify_inventory_service(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
) -> ShopifyInventoryService:
    clean_tenant = sanitize_tenant_id(x_tenant_id)
    if clean_tenant not in current_user.tenants:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado ao tenant especificado.",
        )
    return ShopifyInventoryService(tenant_id=clean_tenant)


@router.patch("/products/{sku}/inventory", summary="Atualização Rápida de Estoque por SKU")
async def update_shopify_inventory(
    sku: str,
    inventory_payload: ShopifyInventoryUpdateInput,
    service: ShopifyInventoryService = Depends(get_shopify_inventory_service),
):
    return await service.update_inventory_by_sku(
        sku=sku,
        quantity=inventory_payload.available_quantity,
        inventory_item_id=inventory_payload.inventory_item_id,
        location_id=inventory_payload.location_id,
    )
