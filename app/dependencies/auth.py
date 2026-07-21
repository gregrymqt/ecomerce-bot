import os
import jwt
from fastapi import Header, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config.settings import settings
from app.config.redis_db import redis_cache

security = HTTPBearer()

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
    
    # 1. Validação de Blacklist idêntica ao Middleware do C#
    if await is_token_blacklisted(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token revogado. Faça login novamente."
        )
        
    try:
        # 2. Decodificação respeitando o AuthServicesExtensions do C#
        secret_key = settings.JWT__Key
        if not secret_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                detail="JWT secret key missing in .env"
            )
            
        # O algoritmo HS256 é utilizado e as validações de aud e iss são ignoradas (conforme C#)
        # O PyJWT valida a expiração ('exp') rigorosamente por padrão (equivalente ao ClockSkew = Zero)
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

    # 3. Blindagem de Isolamento do Cenário B (Múltiplas Lojas autorizadas)
    allowed_tenants = payload.get("tenants", [])
    if isinstance(allowed_tenants, str):
        allowed_tenants = [allowed_tenants]
        
    if x_tenant_id not in allowed_tenants:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado. Você não possui autorização para operar neste Tenant."
        )
        
    return payload
