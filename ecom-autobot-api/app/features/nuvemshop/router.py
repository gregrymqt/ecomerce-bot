from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from typing import List, Optional

from app.features.nuvemshop.services import (
    NuvemshopService,
    NuvemshopStockService,
    NuvemshopWebhookService,
    NuvemshopCategoryService,
    NuvemshopOAuthService,
)
from app.features.nuvemshop.schemas import (
    NuvemshopBatchStockPriceItem,
    NuvemshopBatchStockPriceResponse,
    NuvemshopBulkSyncRequest,
    NuvemshopBulkSyncResponse,
    NuvemshopCategoryCreatePayload,
    NuvemshopCategoryResponse,
    NuvemshopImageResponse,
    NuvemshopImageUpdatePayload,
    NuvemshopImageUploadPayload,
    NuvemshopInventoryLevelListResponse,
    NuvemshopLocationResponse,
    NuvemshopOAuthAuthorizeResponse,
    NuvemshopOAuthTokenResponse,
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


# =====================================================================
# Endpoints de Gestão de Mídias / Galeria de Imagens da Nuvemshop
# =====================================================================

@router.get("/products/{product_id}/images", response_model=List[NuvemshopImageResponse])
async def get_product_images(
    product_id: int,
    service: NuvemshopService = Depends(get_nuvemshop_service),
):
    """
    Lista todas as imagens da galeria de um produto na Nuvemshop.
    """
    client = await service._ensure_client()
    return await client.get_product_images(product_id)


@router.post(
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
    Suporta URL pública (src) ou Buffer/Base64 (attachment + filename).
    """
    client = await service._ensure_client()
    return await client.upload_product_image(product_id, payload)


@router.put("/products/{product_id}/images/{image_id}", response_model=NuvemshopImageResponse)
async def update_product_image(
    product_id: int,
    image_id: int,
    payload: NuvemshopImageUpdatePayload,
    service: NuvemshopService = Depends(get_nuvemshop_service),
):
    """
    Atualiza atributos ou posição (position) de uma imagem existente na galeria.
    """
    client = await service._ensure_client()
    return await client.update_product_image(product_id, image_id, payload)


@router.delete("/products/{product_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
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


# =====================================================================
# Endpoints de Gestão de Categorias da Nuvemshop
# =====================================================================

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


@router.get("/categories", response_model=List[NuvemshopCategoryResponse])
async def get_categories(
    service: NuvemshopCategoryService = Depends(get_nuvemshop_category_service),
):
    """
    Lista todas as categorias cadastradas na loja da Nuvemshop (com cache Redis 1h).
    """
    client = await service._ensure_client()
    return await service.get_cached_categories(client.store_id, client)


@router.post("/categories", status_code=status.HTTP_201_CREATED, response_model=NuvemshopCategoryResponse)
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


def get_nuvemshop_oauth_service() -> NuvemshopOAuthService:
    return NuvemshopOAuthService()


@router.get("/oauth/authorize", response_model=NuvemshopOAuthAuthorizeResponse)
async def oauth_authorize(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    user: AuthenticatedUser = Depends(get_current_tenant_user),
    service: NuvemshopOAuthService = Depends(get_nuvemshop_oauth_service),
):
    """
    Inicia o handshake de autorização OAuth 2.0 em 1-Clique para a Nuvemshop.
    Gera um token 'state' anti-CSRF temporário no Redis e retorna a URL de consentimento.
    """
    clean_tenant = sanitize_tenant_id(x_tenant_id)
    return await service.generate_authorize_url(tenant_id=clean_tenant)


@router.get("/oauth/callback")
async def oauth_callback(
    code: str = Query(..., description="Código de autorização gerado pela Nuvemshop"),
    state: str = Query(..., description="Token anti-CSRF retornado pela Nuvemshop"),
    service: NuvemshopOAuthService = Depends(get_nuvemshop_oauth_service),
):
    """
    Callback público do provedor OAuth da Nuvemshop.
    Valida o token 'state' no Redis (mitigação CSRF), troca o 'code' por 'access_token',
    criptografa o token via AES-256 GCM e executa o auto-registro de webhooks.
    """
    result = await service.process_callback(code=code, state=state)
    return result


@router.post("/webhooks/auto-register")
async def auto_register_webhooks(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    user: AuthenticatedUser = Depends(get_current_tenant_user),
    service: NuvemshopOAuthService = Depends(get_nuvemshop_oauth_service),
):
    """
    Força o auto-registro resiliente de webhooks para a loja vinculada ao tenant ativo.
    """
    clean_tenant = sanitize_tenant_id(x_tenant_id)
    creds = await service.nuvemshop_repo.get_credentials(clean_tenant)
    if not creds or not creds.access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tenant '{clean_tenant}' não possui credenciais válidas da Nuvemshop configuradas.",
        )
    webhooks = await service.auto_register_webhooks(
        tenant_id=clean_tenant,
        store_id=int(creds.store_id),
        access_token=creds.access_token,
    )
    return {
        "status": "success",
        "tenant_id": clean_tenant,
        "store_id": creds.store_id,
        "registered_webhooks": webhooks,
    }





