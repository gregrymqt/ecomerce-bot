from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import get_db
from app.core.config.settings import settings
from app.core.security.auth import get_current_tenant_user
from app.core.security.rate_limiter import rate_limit_dependency
from app.features.auth.schemas import (
    AuthenticatedUser,
    AuthTokenResponse,
    CreateUserRequest,
    EnterpriseLeadRequest,
    EnterpriseLeadResponse,
    GoogleCallbackRequest,
    GoogleLoginUrlResponse,
    LoginRequest,
    LogoutResponse,
    UpdateUserRequest,
    UserResponse,
)
from app.features.auth.services import AuthService, EnterpriseLeadService, GoogleAuthService


router = APIRouter(prefix="/auth", tags=["Auth"])
security = HTTPBearer()


def get_auth_service() -> AuthService:
    return AuthService()


def get_google_auth_service() -> GoogleAuthService:
    return GoogleAuthService()


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
async def register(
    payload: CreateUserRequest,
    service: AuthService = Depends(get_auth_service)
) -> UserResponse:
    """
    Cadastra um novo usuário no banco de dados.
    """
    return await service.register_user(payload)


@router.post("/login", response_model=UserResponse, dependencies=[Depends(rate_limit_dependency(times=5, seconds=60))])
async def login(
    credentials: LoginRequest,
    response: Response,
    service: AuthService = Depends(get_auth_service)
) -> UserResponse:
    return await service.authenticate_user(credentials, response)


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    request: Request,
    response: Response,
    service: AuthService = Depends(get_auth_service)
) -> LogoutResponse:
    """
    Revoga o Token JWT do cookie no Redis e limpa o cookie no navegador.
    """
    # Extrai o token diretamente do Cookie HttpOnly
    token = request.cookies.get("access_token")
    
    if token:
        await service.revoke_token(token)
    
    # Exclui o cookie do navegador zerando seu tempo de vida
    response.delete_cookie(
        key="access_token",
        httponly=True,
        secure=True,
        samesite="none"
    )
    
    return LogoutResponse(message="Logout realizado com sucesso. Cookie e sessão limpos.")


@router.get("/me", response_model=AuthenticatedUser)
async def get_me(
    request: Request,
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
    service: AuthService = Depends(get_auth_service),
) -> AuthenticatedUser:
    """
    Retorna o DTO tipado do perfil do usuário autenticado resolvendo dinamicamente seu plano ativo.
    """
    tenant_id = request.headers.get("X-Tenant-ID")
    return await service.resolve_user_active_plan(current_user, tenant_id=tenant_id)


@router.put("/me", response_model=UserResponse)
async def update_me(
    payload: UpdateUserRequest,
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
    service: AuthService = Depends(get_auth_service)
) -> UserResponse:
    """
    Atualiza as informações do usuário autenticado no banco de dados.
    """
    return await service.update_profile(current_user.user_id, payload)


# -------------------------------------------------------------------
# Google OAuth 2.0 Endpoints
# -------------------------------------------------------------------

@router.get("/google/login", response_model=GoogleLoginUrlResponse)
async def google_login(
    state: Optional[str] = Query(None, description="Estado OAuth para prevenção de CSRF"),
    service: GoogleAuthService = Depends(get_google_auth_service)
) -> GoogleLoginUrlResponse:
    """
    Gera e retorna a URL de redirecionamento para o consentimento do Google OAuth 2.0.
    """
    auth_url = service.get_google_auth_url(state=state)
    return GoogleLoginUrlResponse(url=auth_url)


@router.post(
    "/google/callback",
    response_model=AuthTokenResponse,
    dependencies=[Depends(rate_limit_dependency(times=10, seconds=60))]
)
async def google_callback(
    payload: GoogleCallbackRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    service: GoogleAuthService = Depends(get_google_auth_service)
) -> AuthTokenResponse:
    """
    Processa o callback do Google OAuth 2.0:
    - Realiza a troca assíncrona do 'code' pelos dados do perfil via API Google.
    - Autentica usuário existente ou realiza cadastro do novo usuário com o tenant_name fornecido.
    - Seta o cookie HttpOnly de acesso e retorna o JWT com a lista de tenants autorizados.
    """
    google_user = await service.exchange_code_for_user_info(payload.code)
    token_response = await service.authenticate_google_user(
        db=db,
        google_user=google_user,
        tenant_name=payload.tenant_name
    )

    # Seta o cookie HttpOnly idêntico ao fluxo de login tradicional
    expires_in_seconds = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    response.set_cookie(
        key="access_token",
        value=token_response.access_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=expires_in_seconds,
    )

    return token_response


# -------------------------------------------------------------------
# SSO Enterprise Lead Capture Endpoint (Fake Door Test)
# -------------------------------------------------------------------

def get_enterprise_lead_service() -> EnterpriseLeadService:
    return EnterpriseLeadService()


@router.post(
    "/sso-enterprise/lead",
    response_model=EnterpriseLeadResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit_dependency(times=5, seconds=60))]
)
async def create_enterprise_lead(
    payload: EnterpriseLeadRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    service: EnterpriseLeadService = Depends(get_enterprise_lead_service)
) -> EnterpriseLeadResponse:
    """
    Captura leads corporativos interessados no SSO Enterprise (Fake Door Test),
    persistindo no PostgreSQL, emitindo telemetria e notificando a equipe comercial.
    """
    client_ip = request.client.host if request.client else None
    return await service.register_lead(db=db, payload=payload, ip_address=client_ip)


