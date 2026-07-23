from fastapi import HTTPException, status
from app.core.config.settings import settings
from app.core.security.auth import create_access_token, add_token_to_blacklist
from app.features.auth.schemas import LoginRequest, TokenResponse, UserInfo

class AuthService:
    @staticmethod
    async def authenticate_user(credentials: LoginRequest) -> TokenResponse:
        if not credentials.email or not credentials.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="E-mail e senha são obrigatórios."
            )

        user_id = f"usr_{hash(credentials.email) & 0xffffffff}"
        user_name = credentials.email.split("@")[0].capitalize()
        
        default_tenants = ["ecommerce_demo", "ecommerce_prod"]
        if credentials.tenant_id and credentials.tenant_id not in default_tenants:
            default_tenants.append(credentials.tenant_id)
            
        token_data = {
            "sub": user_id,
            "email": credentials.email,
            "name": user_name,
            "tenants": default_tenants
        }

        expires_in_seconds = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        access_token = create_access_token(data=token_data)

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=expires_in_seconds,
            user=UserInfo(
                id=user_id,
                email=credentials.email,
                name=user_name
            ),
            tenants=default_tenants
        )

    @staticmethod
    async def revoke_token(token: str) -> None:
        await add_token_to_blacklist(token, expire_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
