from fastapi import APIRouter, Depends, Header, status
from typing import List, Dict, Any

from app.features.nuvemshop.service import NuvemshopService
from app.features.nuvemshop.schemas import NuvemshopProductRequest
from app.core.security.auth import get_current_tenant_user

router = APIRouter(
    prefix="/nuvemshop", 
    tags=["Nuvemshop Integration"],
    dependencies=[Depends(get_current_tenant_user)]
)

def get_nuvemshop_service(x_tenant_id: str = Header(..., alias="X-Tenant-ID")) -> NuvemshopService:
    return NuvemshopService(tenant_id=x_tenant_id)

@router.post("/products", status_code=status.HTTP_201_CREATED, response_model=Dict[str, Any])
async def create_product(
    product: NuvemshopProductRequest, 
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    return await service.create_product(product)

@router.get("/products/{product_id}", response_model=Dict[str, Any])
async def get_product_by_id(
    product_id: int, 
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    return await service.get_product_by_id(product_id)

@router.get("/products/sku/{sku}", response_model=Dict[str, Any])
async def get_product_by_sku(
    sku: str, 
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    return await service.get_product_by_sku(sku)

@router.put("/products/{product_id}", response_model=Dict[str, Any])
async def update_product_metadata(
    product_id: int, 
    update_data: Dict[str, Any], 
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    return await service.update_product_metadata(product_id, update_data)

@router.patch("/products/stock-price", response_model=List[Dict[str, Any]])
async def update_stock_price_batch(
    batch_data: List[Dict[str, Any]], 
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    return await service.update_stock_price_batch(batch_data)

@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int, 
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    return await service.delete_product(product_id)
