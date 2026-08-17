from fastapi import APIRouter, Depends, Header, HTTPException, status
from typing import List

from app.core.security.auth import get_current_tenant_user, sanitize_tenant_id
from app.features.auth.schemas import AuthenticatedUser
from app.features.nuvemshop.schemas import (
    NuvemshopBatchStockPriceItem,
    NuvemshopBatchStockPriceResponse,
    NuvemshopBulkSyncRequest,
    NuvemshopBulkSyncResponse,
    NuvemshopImageResponse,
    NuvemshopImageUpdatePayload,
    NuvemshopImageUploadPayload,
    NuvemshopProductRequest,
    NuvemshopProductResponse,
    NuvemshopProductUpdatePayload,
)
from app.features.nuvemshop.services import NuvemshopService

nuvemshop_product_router = APIRouter(prefix="/nuvemshop", tags=["Nuvemshop Products & Media"])


def get_nuvemshop_service(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
) -> NuvemshopService:
    clean_tenant = sanitize_tenant_id(x_tenant_id)
    if clean_tenant not in current_user.tenants:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado ao tenant especificado.",
        )
    return NuvemshopService(tenant_id=clean_tenant)


@nuvemshop_product_router.post(
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


@nuvemshop_product_router.post("/products", status_code=status.HTTP_201_CREATED, response_model=NuvemshopProductResponse)
async def create_product(
    product: NuvemshopProductRequest,
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    return await service.create_product(product)


@nuvemshop_product_router.get("/products/{product_id}", response_model=NuvemshopProductResponse)
async def get_product_by_id(
    product_id: int,
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    return await service.get_product_by_id(product_id)


@nuvemshop_product_router.get("/products/sku/{sku}", response_model=NuvemshopProductResponse)
async def get_product_by_sku(
    sku: str,
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    return await service.get_product_by_sku(sku)


@nuvemshop_product_router.put("/products/{product_id}", response_model=NuvemshopProductResponse)
async def update_product_metadata(
    product_id: int,
    update_data: NuvemshopProductUpdatePayload,
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    return await service.update_product_metadata(product_id, update_data.model_dump(exclude_none=True))


@nuvemshop_product_router.patch("/products/stock-price", response_model=NuvemshopBatchStockPriceResponse)
async def update_stock_price_batch(
    batch_data: List[NuvemshopBatchStockPriceItem],
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    return await service.update_stock_price_batch([item.model_dump(exclude_none=True) for item in batch_data])


@nuvemshop_product_router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    service: NuvemshopService = Depends(get_nuvemshop_service)
):
    return await service.delete_product(product_id)


# =====================================================================
# Endpoints de Gestão de Mídias / Galeria de Imagens da Nuvemshop
# =====================================================================

@nuvemshop_product_router.get("/products/{product_id}/images", response_model=List[NuvemshopImageResponse])
async def get_product_images(
    product_id: int,
    service: NuvemshopService = Depends(get_nuvemshop_service),
):
    """
    Lista todas as imagens da galeria de um produto na Nuvemshop.
    """
    client = await service._ensure_client()
    return await client.get_product_images(product_id)


@nuvemshop_product_router.post(
    "/products/{product_id}/images",
    status_code=status.HTTP_201_CREATED,
    response_model=NuvemshopImageResponse,
)
async def upload_product_image(
    product_id: int,
    payload: NuvemshopImageUploadPayload,
    service: NuvemshopService = Depends(get_nuvemshop_service),
):
    """
    Upload de nova imagem para a galeria do produto na Nuvemshop.
    """
    client = await service._ensure_client()
    return await client.upload_product_image(product_id, payload)


@nuvemshop_product_router.put("/products/{product_id}/images/{image_id}", response_model=NuvemshopImageResponse)
async def update_product_image(
    product_id: int,
    image_id: int,
    payload: NuvemshopImageUpdatePayload,
    service: NuvemshopService = Depends(get_nuvemshop_service),
):
    """
    Atualiza atributos ou posição de uma imagem existente na galeria.
    """
    client = await service._ensure_client()
    return await client.update_product_image(product_id, image_id, payload)


@nuvemshop_product_router.delete("/products/{product_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_image(
    product_id: int,
    image_id: int,
    service: NuvemshopService = Depends(get_nuvemshop_service),
):
    """
    Remove uma imagem específica da galeria do produto na Nuvemshop.
    """
    client = await service._ensure_client()
    await client.delete_product_image(product_id, image_id)
    return None
