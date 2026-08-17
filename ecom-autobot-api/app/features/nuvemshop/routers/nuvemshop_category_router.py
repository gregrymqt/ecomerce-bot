from fastapi import APIRouter, Depends, Header, HTTPException, status
from typing import List

from app.core.security.auth import get_current_tenant_user, sanitize_tenant_id
from app.features.auth.schemas import AuthenticatedUser
from app.features.nuvemshop.schemas import (
    NuvemshopCategoryCreatePayload,
    NuvemshopCategoryResponse,
)
from app.features.nuvemshop.services import NuvemshopCategoryService

nuvemshop_category_router = APIRouter(prefix="/nuvemshop", tags=["Nuvemshop Categories"])


def get_nuvemshop_category_service(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
) -> NuvemshopCategoryService:
    clean_tenant = sanitize_tenant_id(x_tenant_id)
    if clean_tenant not in current_user.tenants:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado ao tenant especificado.",
        )
    return NuvemshopCategoryService(tenant_id=clean_tenant)


@nuvemshop_category_router.get("/categories", response_model=List[NuvemshopCategoryResponse])
async def get_categories(
    service: NuvemshopCategoryService = Depends(get_nuvemshop_category_service),
):
    """
    Lista todas as categorias cadastradas na loja da Nuvemshop (com cache Redis 1h).
    """
    client = await service._ensure_client()
    return await service.get_cached_categories(client.store_id, client)


@nuvemshop_category_router.post("/categories", status_code=status.HTTP_201_CREATED, response_model=NuvemshopCategoryResponse)
async def create_category(
    payload: NuvemshopCategoryCreatePayload,
    service: NuvemshopCategoryService = Depends(get_nuvemshop_category_service),
):
    """
    Cria uma nova categoria manualmente na Nuvemshop e invalida o cache Redis.
    """
    client = await service._ensure_client()
    res = await client.create_category(payload)
    cache_key = f"ecom:categories:nuvemshop:{client.store_id}"
    try:
        from app.core.config.redis_db import redis_cache
        await redis_cache.delete(cache_key)
    except Exception:
        pass
    return res
