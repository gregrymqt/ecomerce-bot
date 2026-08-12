from typing import Dict, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse, RedirectResponse

from app.features.shopify.services import ShopifyService, ShopifyWebhookService, ShopifyAuthService
from app.features.shopify.repositories import ShopifyRepository
from app.core.config.redis_db import redis_cache
from app.core.security.auth import get_current_tenant_user, sanitize_tenant_id
from app.features.auth.schemas import AuthenticatedUser
from app.features.shopify.schemas import (
    ShopifyMediaAddRequest,
    ShopifyProductResponse,
    ShopifyProductUpdateInput,
    ShopifySyncRequest,
    ShopifyInventoryUpdateInput,
    ShopifyStatusUpdateInput,
)


router = APIRouter(
    prefix="/shopify",
    tags=["Shopify GraphQL Integration"],
)


def get_shopify_webhook_service() -> ShopifyWebhookService:
    return ShopifyWebhookService()


def get_shopify_auth_service() -> ShopifyAuthService:
    return ShopifyAuthService()


@router.post(
    "/webhooks",
    status_code=status.HTTP_200_OK,
    summary="Receptor de Webhooks da Shopify com Validação HMAC-SHA256",
)
async def shopify_webhook(
    request: Request,
    x_shopify_hmac: Optional[str] = Header(None, alias="X-Shopify-Hmac-Sha256"),
    x_shopify_webhook_id: Optional[str] = Header(None, alias="X-Shopify-Webhook-Id"),
    x_shopify_shop_domain: Optional[str] = Header(None, alias="X-Shopify-Shop-Domain"),
    x_shopify_topic: Optional[str] = Header(None, alias="X-Shopify-Topic"),
    webhook_service: ShopifyWebhookService = Depends(get_shopify_webhook_service),
) -> JSONResponse:
    """
    Recebe, valida e enfileira webhooks enviados pelo Shopify.
    Delega a validação HMAC, verificação de idempotência no Redis e enfileiramento ao ShopifyWebhookService.
    """
    raw_body = await request.body()
    result = await webhook_service.process_incoming_webhook(
        raw_body=raw_body,
        hmac_header=x_shopify_hmac,
        webhook_id=x_shopify_webhook_id,
        shop_domain=x_shopify_shop_domain,
        topic=x_shopify_topic,
    )
    return JSONResponse(status_code=status.HTTP_200_OK, content=result)


@router.get(
    "/auth",
    summary="Início da Autorização OAuth 2.0 da Shopify",
    description="Gera a URL de autorização oficial da Shopify com state aleatório (UUID v4) e salva no Redis por 10 minutos.",
)
async def shopify_auth_start(
    shop: str = Query(..., description="Domínio da loja Shopify (ex: loja.myshopify.com)"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
    auth_service: ShopifyAuthService = Depends(get_shopify_auth_service),
) -> JSONResponse:
    tenant_id = current_user.tenants[0] if current_user.tenants else "ecommerce_prod"
    authorize_url = await auth_service.initiate_oauth_flow(shop_domain=shop, tenant_id=tenant_id)
    return JSONResponse(status_code=status.HTTP_200_OK, content={"authorize_url": authorize_url})


@router.get(
    "/auth/callback",
    summary="Callback de Redirecionamento OAuth 2.0 da Shopify",
    description="Valida o state no Redis, confirma a assinatura HMAC Hexadecimal, troca o code pelo access_token permanente, salva credenciais e cadastra webhooks.",
)
async def shopify_auth_callback(
    request: Request,
    code: str = Query(...),
    shop: str = Query(...),
    state: str = Query(...),
    hmac_param: str = Query(..., alias="hmac"),
    auth_service: ShopifyAuthService = Depends(get_shopify_auth_service),
) -> RedirectResponse:
    query_params = dict(request.query_params)
    redirect_target = await auth_service.handle_oauth_callback(
        query_params=query_params,
        code=code,
        shop_domain=shop,
        state=state,
    )
    return RedirectResponse(url=redirect_target, status_code=status.HTTP_307_TEMPORARY_REDIRECT)






def get_shopify_service(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
) -> ShopifyService:
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
    return ShopifyService(tenant_id=clean_tenant)

@router.post("/products", status_code=status.HTTP_201_CREATED, response_model=ShopifyProductResponse)
async def sync_product_to_shopify(
    product_data: ShopifySyncRequest,
    service: ShopifyService = Depends(get_shopify_service)
):
    return await service.sync_product(product_data.model_dump())

@router.post("/products/{product_id}/media", status_code=status.HTTP_201_CREATED, response_model=ShopifyProductResponse)
async def add_media_to_product(
    product_id: str,
    media_payload: ShopifyMediaAddRequest,
    service: ShopifyService = Depends(get_shopify_service)
):
    return await service.add_media_to_product(product_id, media_payload)

@router.put("/products/{product_id}", response_model=ShopifyProductResponse)
async def update_shopify_product(
    product_id: str,
    update_payload: ShopifyProductUpdateInput,
    service: ShopifyService = Depends(get_shopify_service)
):
    return await service.update_product(product_id, update_payload.model_dump(exclude_none=True))

@router.patch("/products/{sku}/inventory", summary="Atualização Rápida de Estoque por SKU")
async def update_shopify_inventory(
    sku: str,
    inventory_payload: ShopifyInventoryUpdateInput,
    service: ShopifyService = Depends(get_shopify_service),
):
    return await service.update_inventory_by_sku(
        sku=sku,
        quantity=inventory_payload.available_quantity,
        inventory_item_id=inventory_payload.inventory_item_id,
        location_id=inventory_payload.location_id,
    )


@router.patch("/products/{sku}/status", summary="Alteração de Status do Produto na Shopify")
async def update_shopify_status(
    sku: str,
    status_payload: ShopifyStatusUpdateInput,
    service: ShopifyService = Depends(get_shopify_service),
):
    return await service.change_product_status_by_sku(
        sku=sku,
        status_value=status_payload.status,
    )


@router.delete("/products/{sku}", status_code=status.HTTP_200_OK, summary="Exclusão Remota do Produto na Shopify")
async def delete_shopify_product_by_sku(
    sku: str,
    service: ShopifyService = Depends(get_shopify_service),
):
    return await service.delete_remote_product_by_sku(sku=sku)


@router.get("/products", response_model=ShopifyProductResponse)
async def list_shopify_products(
    first: int = 10,
    after: str | None = None,
    service: ShopifyService = Depends(get_shopify_service)
):
    return await service.list_products(first=first, after=after)

