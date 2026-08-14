from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from typing import List, Optional

from app.features.nuvemshop.services import (
    NuvemshopService,
    NuvemshopStockService,
    NuvemshopWebhookService,
)
from app.features.nuvemshop.schemas import (
    NuvemshopBatchStockPriceItem,
    NuvemshopBatchStockPriceResponse,
    NuvemshopBulkSyncRequest,
    NuvemshopBulkSyncResponse,
    NuvemshopInventoryLevelListResponse,
    NuvemshopLocationResponse,
    NuvemshopProductRequest,
    NuvemshopProductResponse,
    NuvemshopProductUpdatePayload,
    NuvemshopStockUpdateBatchRequest,
)
from app.core.security.auth import get_current_tenant_user, sanitize_tenant_id
from app.features.auth.schemas import AuthenticatedUser

router = APIRouter(
    prefix="/nuvemshop",
    tags=["Nuvemshop Integration"],
)


def get_nuvemshop_webhook_service() -> NuvemshopWebhookService:
    return NuvemshopWebhookService()


@router.post("/webhooks", status_code=status.HTTP_200_OK)
async def nuvemshop_webhook(
    request: Request,
    x_linkedstore_hmac_sha256: Optional[str] = Header(None, alias="X-Linkedstore-Hmac-Sha256"),
    service: NuvemshopWebhookService = Depends(get_nuvemshop_webhook_service),
):
    """
    Endpoint público de recepção de Webhooks da Nuvemshop.
    Valida a assinatura HMAC, aplica idempotência no Redis e publica no RabbitMQ em < 2s.
    """
    raw_body = await request.body()
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    return await service.enqueue_webhook_event(
        payload=payload,
        raw_body=raw_body,
        hmac_header=x_linkedstore_hmac_sha256,
    )


def get_nuvemshop_service(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
) -> NuvemshopService:
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
    return NuvemshopService(tenant_id=clean_tenant)


def get_nuvemshop_stock_service(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
) -> NuvemshopStockService:
    """
    Fábrica de serviço de estoque que valida se o X-Tenant-ID do header está
    explicitamente autorizado nas claims do token JWT do usuário.
    """
    clean_tenant = sanitize_tenant_id(x_tenant_id)
    if clean_tenant not in current_user.tenants:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado ao tenant especificado.",
        )
    return NuvemshopStockService(tenant_id=clean_tenant)


@router.get("/locations", response_model=List[NuvemshopLocationResponse])
async def get_locations(
    service: NuvemshopStockService = Depends(get_nuvemshop_stock_service),
):
    """
    Retorna a lista de depósitos / localizações de estoque cadastrados na Nuvemshop para o tenant.
    """
    return await service.get_tenant_locations()


@router.get("/locations/{location_id}/inventory-levels", response_model=NuvemshopInventoryLevelListResponse)
async def get_location_inventory_levels(
    location_id: str,
    variant_id: Optional[str] = Query(None, description="Filtro opcional por ID de variante"),
    page: int = Query(1, ge=1, description="Número da página"),
    per_page: int = Query(10, ge=1, le=200, description="Itens por página"),
    service: NuvemshopStockService = Depends(get_nuvemshop_stock_service),
):
    """
    Retorna a lista paginada de saldos de estoque por localização/depósito na Nuvemshop.
    """
    return await service.get_inventory_levels(
        location_id=location_id,
        variant_id=variant_id,
        page=page,
        per_page=per_page,
    )


@router.patch("/locations/{location_id}/inventory-levels")
async def update_location_inventory_levels(
    location_id: str,
    payload: NuvemshopStockUpdateBatchRequest,
    service: NuvemshopStockService = Depends(get_nuvemshop_stock_service),
):
    """
    Atualiza diretamente os saldos de estoque por variante em determinado depósito
    com proteção por trava distribuída no Redis.
    """
    await service.update_stock_with_lock(location_id=location_id, items=payload.items)
    return {
        "status": "success",
        "message": f"Estoque de {len(payload.items)} item(ns) atualizado com sucesso no depósito {location_id}.",
    }


@router.post(
    "/products/bulk-sync",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=NuvemshopBulkSyncResponse,
)
async def bulk_sync_products(
    payload: NuvemshopBulkSyncRequest,
    service: NuvemshopService = Depends(get_nuvemshop_service),
):
    """
    Inicia a sincronização assíncrona em lote de produtos para a Nuvemshop.
    Valida credenciais, gera job_id UUID v4 e enfileira SKUs no RabbitMQ em < 200ms.
    """
    return await service.enqueue_bulk_sync(
        skus=payload.skus,
        force_update=payload.force_update,
        visibility=payload.visibility,
    )


@router.post("/products", status_code=status.HTTP_201_CREATED, response_model=NuvemshopProductResponse)
async def create_product(
    product: NuvemshopProductRequest,
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    return await service.create_product(product)

@router.get("/products/{product_id}", response_model=NuvemshopProductResponse)
async def get_product_by_id(
    product_id: int,
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    return await service.get_product_by_id(product_id)

@router.get("/products/sku/{sku}", response_model=NuvemshopProductResponse)
async def get_product_by_sku(
    sku: str,
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    return await service.get_product_by_sku(sku)

@router.put("/products/{product_id}", response_model=NuvemshopProductResponse)
async def update_product_metadata(
    product_id: int,
    update_data: NuvemshopProductUpdatePayload,
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    return await service.update_product_metadata(product_id, update_data.model_dump(exclude_none=True))

@router.patch("/products/stock-price", response_model=NuvemshopBatchStockPriceResponse)
async def update_stock_price_batch(
    batch_data: List[NuvemshopBatchStockPriceItem],
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    return await service.update_stock_price_batch([item.model_dump(exclude_none=True) for item in batch_data])

@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    return await service.delete_product(product_id)


