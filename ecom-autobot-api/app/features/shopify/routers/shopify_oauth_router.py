from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse, RedirectResponse

from app.core.security.auth import get_current_tenant_user
from app.features.auth.schemas import AuthenticatedUser
from app.features.shopify.services import ShopifyAuthService

router = APIRouter(prefix="/shopify", tags=["Shopify OAuth"])


def get_shopify_auth_service() -> ShopifyAuthService:
    return ShopifyAuthService()


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
