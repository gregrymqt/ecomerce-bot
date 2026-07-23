from fastapi import APIRouter, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.security.auth import get_current_tenant_user
from app.features.auth.schemas import LoginRequest, TokenResponse, LogoutResponse
from app.features.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])
security = HTTPBearer()

@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest):
    """
    Realiza autenticação e emite o Token JWT assinado contendo as permissões de Tenant.
    """
    return await AuthService.authenticate_user(credentials)

@router.post("/logout", response_model=LogoutResponse)
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Revoga o Token JWT atual adicionando-o à blacklist no Redis.
    """
    token = credentials.credentials
    await AuthService.revoke_token(token)
    return LogoutResponse(message="Logout realizado com sucesso. Token invalidado no backend.")

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_tenant_user)):
    """
    Retorna os dados do perfil do usuário autenticado no token JWT.
    """
    return {
        "user_id": current_user.get("sub"),
        "email": current_user.get("email"),
        "name": current_user.get("name"),
        "tenants": current_user.get("tenants", [])
    }
