from datetime import datetime, timedelta, timezone
import os
import jwt
from fastapi import Header, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config.settings import settings
from app.core.config.redis_db import redis_cache

security = HTTPBearer()

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    Cria e assina um novo Token JWT (HS256) com as claims fornecidas (ex: sub, tenants).
    """
    secret_key = settings.JWT_SECRET_KEY
    if not secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT secret key missing in .env"
        )
    
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
    to_encode.update({
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp())
    })
    
    return jwt.encode(to_encode, secret_key, algorithm="HS256")

async def add_token_to_blacklist(token: str, expire_seconds: int = 86400) -> None:
    """
    Insere o token na blacklist no Redis para invalidá-lo após o logout.
    """
    await redis_cache.set(f"blacklist:{token}", "revoked", expire_seconds=expire_seconds)

async def is_token_blacklisted(token: str) -> bool:
    """
    Verifica na infraestrutura de cache (Redis) se o token está na blacklist.
    """
    is_blacklisted = await redis_cache.get(f"blacklist:{token}")
    return bool(is_blacklisted)

async def get_current_tenant_user(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials
    
    # 1. Validação de Blacklist de tokens revogados no Redis
    if await is_token_blacklisted(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token revogado. Faça login novamente."
        )
        
    try:
        # 2. Decodificação segura do Token JWT
        secret_key = settings.JWT_SECRET_KEY
        if not secret_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                detail="JWT secret key missing in .env"
            )
            
        payload = jwt.decode(
            token, 
            secret_key, 
            algorithms=["HS256"],
            options={"verify_aud": False, "verify_iss": False}
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Token expirado."
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Token inválido."
        )

    # 3. Blindagem de Isolamento Multi-Tenant
    allowed_tenants = payload.get("tenants", [])
    if isinstance(allowed_tenants, str):
        allowed_tenants = [allowed_tenants]
        
    if x_tenant_id not in allowed_tenants:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado. Você não possui autorização para operar neste Tenant."
        )
        
    return payload
