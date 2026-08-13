from fastapi import APIRouter, Depends, Header, HTTPException, status
from typing import List

from app.features.nuvemshop.services import NuvemshopService, NuvemshopStockService
from app.features.nuvemshop.schemas import (
    NuvemshopBatchStockPriceItem,
    NuvemshopBatchStockPriceResponse,
    NuvemshopLocationResponse,
    NuvemshopProductRequest,
    NuvemshopProductResponse,
    NuvemshopProductUpdatePayload,
)
from app.core.security.auth import get_current_tenant_user, sanitize_tenant_id
from app.features.auth.schemas import AuthenticatedUser

router = APIRouter(
    prefix="/nuvemshop",
    tags=["Nuvemshop Integration"],
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

