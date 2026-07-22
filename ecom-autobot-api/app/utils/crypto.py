import os
import base64
import logging
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config.database import AsyncSessionLocal
from app.models.database_models import TenantConfigModel

logger = logging.getLogger(__name__)

def _get_key() -> bytes:
    from app.config.settings import settings
    key_b64 = settings.AES_MASTER_KEY or os.environ.get("AES_MASTER_KEY")
    if not key_b64:
        raise ValueError("AES_MASTER_KEY não configurada no ambiente.")
    return base64.b64decode(key_b64)

def encrypt_api_key(plain_text: str) -> str:
    """Criptografa uma string usando AES-256-GCM."""
    if not plain_text:
        return plain_text
    key = _get_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    cipher_text = aesgcm.encrypt(nonce, plain_text.encode('utf-8'), None)
    return base64.b64encode(nonce + cipher_text).decode('utf-8')

def decrypt_api_key(cipher_text_b64: str) -> str:
    """Descriptografa uma string usando AES-256-GCM."""
    if not cipher_text_b64:
        return cipher_text_b64
    try:
        key = _get_key()
        aesgcm = AESGCM(key)
        data = base64.b64decode(cipher_text_b64)
        if len(data) < 12:
            raise ValueError("Tamanho dos dados insuficientes para extração do IV (mínimo de 12 bytes).")
        nonce = data[:12]
        cipher_text = data[12:]
        plain_text = aesgcm.decrypt(nonce, cipher_text, None)
        return plain_text.decode('utf-8')
    except Exception as e:
        logger.error(f"Erro ao descriptografar chave: {e}")
        raise ValueError("Falha crítica de segurança: Tag de autenticação inválida ou dados corrompidos.") from e


async def get_tenant_key(tenant_id: str, provider: str) -> str | None:
    """Lê a chave criptografada (BYOK) do tenant na tabela 'tenant_configs' e a descriptografa."""
    async with AsyncSessionLocal() as session:
        config = await session.get(TenantConfigModel, tenant_id)
        if not config:
            return None
        encrypted_keys = config.encrypted_keys or {}
        encrypted_value = encrypted_keys.get(f"{provider.lower()}_api_key")
        if not encrypted_value:
            return None
        return decrypt_api_key(encrypted_value)


async def save_tenant_key(tenant_id: str, provider: str, raw_token: str) -> str:
    """Criptografa e persiste a chave do tenant na tabela 'tenant_configs' (BYOK)."""
    from sqlalchemy import select
    encrypted_value = encrypt_api_key(raw_token)
    async with AsyncSessionLocal() as session:
        config = await session.get(TenantConfigModel, tenant_id)
        if config is None:
            config = TenantConfigModel(tenant_id=tenant_id, encrypted_keys={})
            session.add(config)
        keys = dict(config.encrypted_keys or {})
        keys[f"{provider.lower()}_api_key"] = encrypted_value
        config.encrypted_keys = keys
        await session.commit()
    return encrypted_value
