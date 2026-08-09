from datetime import datetime, timedelta, timezone
import re
from typing import Optional
import jwt
from fastapi import Header, HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config.settings import settings
from app.core.config.redis_db import redis_cache
from app.features.auth.schemas.auth_schemas import AuthenticatedUser

security = HTTPBearer(auto_error=False)


def extract_token_from_request(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """Extrai o token JWT do header Authorization: Bearer ou do cookie HttpOnly access_token."""
    if credentials and credentials.credentials:
        return credentials.credentials
    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        return cookie_token
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token de autenticação não fornecido.",
    )


def sanitize_tenant_id(tenant_id: str) -> str:
    """Sanitiza o X-Tenant-ID garantindo apenas caracteres alfanuméricos e hífens."""
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Header X-Tenant-ID é obrigatório."
        )
    cleaned = tenant_id.strip()
    if not re.match(r"^[a-zA-Z0-9_-]+$", cleaned):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Header X-Tenant-ID possui formato inválido."
        )
    return cleaned


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Cria e assina um novo Token JWT (HS256) com as claims fornecidas."""
    secret_key = settings.JWT_SECRET_KEY
    if not secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT secret key missing in settings."
        )

    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta if expires_delta else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))

    to_encode.update({
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp())
    })

    return jwt.encode(to_encode, secret_key, algorithm="HS256")


async def add_token_to_blacklist(token: str, expire_seconds: int = 86400) -> None:
    """Insere o token na blacklist no Redis para invalidá-lo após o logout."""
    await redis_cache.set(f"blacklist:{token}", "revoked", expire_seconds=expire_seconds)


async def is_token_blacklisted(token: str) -> bool:
    """Verifica na infraestrutura de cache (Redis) se o token está na blacklist."""
    is_blacklisted = await redis_cache.get(f"blacklist:{token}")
    return bool(is_blacklisted)


async def get_current_tenant_user(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    token: str = Depends(extract_token_from_request),
) -> AuthenticatedUser:
    """
    Valida e injeta o usuário autenticado garantindo que ele possui permissão
    no tenant solicitado via X-Tenant-ID.
    """
    clean_tenant = sanitize_tenant_id(x_tenant_id)

    if await is_token_blacklisted(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token revogado. Faça login novamente."
        )

    try:
        secret_key = settings.JWT_SECRET_KEY
        if not secret_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="JWT secret key missing in settings."
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

    allowed_tenants = payload.get("tenants", [])
    if isinstance(allowed_tenants, str):
        allowed_tenants = [allowed_tenants]

    # Validação estrita de escopo multi-tenant
    if clean_tenant not in allowed_tenants:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado. Você não possui autorização para operar neste Tenant."
        )

    # Checagem de role/claim de admin
    is_admin = payload.get("is_admin") is True or payload.get("role") == "admin"

    return AuthenticatedUser(
        sub=str(payload.get("sub", "")),
        email=str(payload.get("email", "")),
        name=str(payload.get("name", "")),
        tenants=allowed_tenants,
        plan=str(payload.get("plan", "free")),
        is_admin=is_admin,
        role=str(payload.get("role", "admin" if is_admin else "user")),
    )


async def get_current_user_admin(
    token: str = Depends(extract_token_from_request),
) -> AuthenticatedUser:
    """
    Valida privilégios administrativos estritos baseados em roles/claims JWT explícitas.
    """
    if await is_token_blacklisted(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token revogado. Faça login novamente."
        )

    try:
        secret_key = settings.JWT_SECRET_KEY
        if not secret_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="JWT secret key missing in settings."
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

    is_admin = payload.get("is_admin") is True or payload.get("role") == "admin"

    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado. Apenas administradores do sistema possuem permissão para esta operação."
        )

    allowed_tenants = payload.get("tenants", [])
    if isinstance(allowed_tenants, str):
        allowed_tenants = [allowed_tenants]

    return AuthenticatedUser(
        sub=str(payload.get("sub", "")),
        email=str(payload.get("email", "")),
        name=str(payload.get("name", "")),
        tenants=allowed_tenants,
        plan=str(payload.get("plan", "admin")),
        is_admin=True,
        role="admin",
    )