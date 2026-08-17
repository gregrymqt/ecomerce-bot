from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from typing import List, Optional

from app.core.security.auth import get_current_tenant_user, sanitize_tenant_id
from app.features.auth.schemas import AuthenticatedUser
from app.features.nuvemshop.schemas import (
    NuvemshopInventoryLevelListResponse,
    NuvemshopLocationResponse,
    NuvemshopStockUpdateBatchRequest,
)
from app.features.nuvemshop.services import NuvemshopStockService

nuvemshop_stock_router = APIRouter(prefix="/nuvemshop", tags=["Nuvemshop Stock"])


def get_nuvemshop_stock_service(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
) -> NuvemshopStockService:
    clean_tenant = sanitize_tenant_id(x_tenant_id)
    if clean_tenant not in current_user.tenants:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado ao tenant especificado.",
        )
    return NuvemshopStockService(tenant_id=clean_tenant)


@nuvemshop_stock_router.get("/locations", response_model=List[NuvemshopLocationResponse])
async def get_locations(
    service: NuvemshopStockService = Depends(get_nuvemshop_stock_service),
):
    """
    Retorna a lista de depósitos / localizações de estoque cadastrados na Nuvemshop para o tenant.
    """
    return await service.get_tenant_locations()


@nuvemshop_stock_router.get("/locations/{location_id}/inventory-levels", response_model=NuvemshopInventoryLevelListResponse)
async def get_location_inventory_levels(
    location_id: str,
    variant_id: Optional[str] = Query(None, description="Filtro opcional por ID de variante"),
    page: int = Query(1, ge=1, description="Número da página"),
    per_page: int = Query(1, ge=1, le=200, description="Itens por página"),
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


@nuvemshop_stock_router.patch("/locations/{location_id}/inventory-levels")
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
