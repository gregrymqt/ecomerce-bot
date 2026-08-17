from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from app.core.security.auth import get_current_tenant_user
from app.features.auth.schemas import AuthenticatedUser
from app.features.products.domain import ProductNotFoundError
from app.features.products.schemas import (
    PaginatedProductsResponse,
    Product,
    ProductUpdateSchema,
)
from app.features.products.services import product_service

router = APIRouter(prefix="/products", tags=["Products & Catalog"])


@router.get("", response_model=PaginatedProductsResponse, status_code=status.HTTP_200_OK)
async def list_products(
    status_filter: Optional[str] = Query(None, alias="status", description="Filtrar por status (Raw, Processing, Processed, Failed, Exported)"),
    search: Optional[str] = Query(None, description="Busca textual por título ou SKU"),
    page: int = Query(1, ge=1, description="Número da página"),
    limit: int = Query(20, ge=1, le=100, description="Itens por página"),
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
):
    """
    Retorna a lista paginada de produtos para a Datatable do Catálogo.
    """
    return await product_service.list_catalog_products(
        tenant_id=x_tenant_id,
        status_filter=status_filter,
        search=search,
        page=page,
        limit=limit,
    )


@router.patch("/{sku}", response_model=Product, status_code=status.HTTP_200_OK)
async def update_product(
    sku: str,
    payload: ProductUpdateSchema,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
):
    """
    Edita informações do produto no catálogo (título, copy, preço e tags).
    """
    try:
        return await product_service.update_product_details(
            tenant_id=x_tenant_id,
            sku=sku,
            data=payload,
        )
    except ProductNotFoundError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err),
        )


@router.delete("/{sku}", status_code=status.HTTP_200_OK)
async def delete_product(
    sku: str,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
):
    """
    Remove um produto indesejado do banco de dados e do cache.
    """
    try:
        return await product_service.delete_product(tenant_id=x_tenant_id, sku=sku)
    except ProductNotFoundError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err),
        )