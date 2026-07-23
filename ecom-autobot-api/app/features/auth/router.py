from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.security.auth import get_current_tenant_user
from app.features.auth.schemas import (
    LoginRequest, 
    CreateUserRequest, 
    UpdateUserRequest, 
    TokenResponse, 
    UserResponse, 
    LogoutResponse,
    AuthenticatedUser
)
from app.features.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])
security = HTTPBearer()

def get_auth_service() -> AuthService:
    return AuthService()

@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
async def register(
    payload: CreateUserRequest,
    service: AuthService = Depends(get_auth_service)
) -> UserResponse:
    """
    Cadastra um novo usuário no banco de dados.
    """
    return await service.register_user(payload)

@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: LoginRequest,
    service: AuthService = Depends(get_auth_service)
) -> TokenResponse:
    """
    Realiza autenticação e emite o Token JWT assinado contendo as permissões de Tenant.
    """
    return await service.authenticate_user(credentials)

@router.post("/logout", response_model=LogoutResponse)
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    service: AuthService = Depends(get_auth_service)
) -> LogoutResponse:
    """
    Revoga o Token JWT atual adicionando-o à blacklist no Redis.
    """
    token = credentials.credentials
    await service.revoke_token(token)
    return LogoutResponse(message="Logout realizado com sucesso. Token invalidado no backend.")

@router.get("/me", response_model=AuthenticatedUser)
async def get_me(
    current_user: AuthenticatedUser = Depends(get_current_tenant_user)
) -> AuthenticatedUser:
    """
    Retorna o DTO tipado do perfil do usuário autenticado contido no token JWT.
    """
    return current_user

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
