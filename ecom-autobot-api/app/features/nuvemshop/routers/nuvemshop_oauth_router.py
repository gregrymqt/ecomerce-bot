from fastapi import APIRouter, Depends, Header, Query
from app.core.security.auth import get_current_tenant_user, sanitize_tenant_id
from app.features.auth.schemas import AuthenticatedUser
from app.features.nuvemshop.schemas import NuvemshopOAuthAuthorizeResponse
from app.features.nuvemshop.services import NuvemshopOAuthService

nuvemshop_oauth_router = APIRouter(prefix="/nuvemshop", tags=["Nuvemshop OAuth"])


def get_nuvemshop_oauth_service() -> NuvemshopOAuthService:
    return NuvemshopOAuthService()


@nuvemshop_oauth_router.get("/oauth/authorize", response_model=NuvemshopOAuthAuthorizeResponse)
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


@nuvemshop_oauth_router.get("/oauth/callback")
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
