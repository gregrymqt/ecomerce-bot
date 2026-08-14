from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.core.security.auth import get_current_tenant_user, sanitize_tenant_id
from app.features.auth.schemas import AuthenticatedUser
from app.features.shopify.schemas import ShopifyBulkSyncRequest
from app.features.shopify.services import ShopifyBulkService

router = APIRouter(prefix="/shopify", tags=["Shopify Bulk API Integration"])


def get_shopify_bulk_service(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
) -> ShopifyBulkService:
    clean_tenant = sanitize_tenant_id(x_tenant_id)
    if clean_tenant not in current_user.tenants:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado ao tenant especificado.",
        )
    return ShopifyBulkService(tenant_id=clean_tenant)


@router.post(
    "/products/bulk-sync",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Sincronização em Massa de Produtos via Bulk API GraphQL",
    description="Dispara mutações em lote usando a Bulk API do Shopify (JSONL + Staged Uploads). Retorna 202 Accepted.",
)
async def bulk_sync_shopify_products(
    request_data: ShopifyBulkSyncRequest,
    service: ShopifyBulkService = Depends(get_shopify_bulk_service),
):
    return await service.sync_bulk_catalog(skus=request_data.skus)
