from datetime import datetime, timezone
import logging
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import AsyncSessionLocal
from app.core.config.redis_db import redis_cache
from app.features.products.domain.models import TenantConfigModel

logger = logging.getLogger(__name__)


class TenantConfigRepository:
    """
    Repositório assíncrono para as configurações de Tenant (chaves API e tokens de e-commerce).
    Utiliza estratégia de Cache-Aside no Redis.
    """

    CACHE_TTL = 3600  # 1 hora em segundos

    def __init__(self, session: Optional[AsyncSession] = None):
        self.session = session

    async def _get_session(self) -> Tuple[AsyncSession, bool]:
        if self.session is not None:
            return self.session, False
        session = AsyncSessionLocal()
        return session, True

    def _model_to_dict(self, model: TenantConfigModel) -> Dict[str, Any]:
        """Converte TenantConfigModel para dicionário serializável em JSON."""
        return {
            "tenant_id": model.tenant_id,
            "encrypted_keys": model.encrypted_keys or {},
            "created_at": model.created_at.isoformat() if hasattr(model, "created_at") and model.created_at else None,
            "updated_at": model.updated_at.isoformat() if hasattr(model, "updated_at") and model.updated_at else None,
        }

    def _dict_to_model(self, data: Dict[str, Any]) -> TenantConfigModel:
        """Reconstrói um TenantConfigModel a partir de dicionário recuperado do cache."""
        return TenantConfigModel(
            tenant_id=data["tenant_id"],
            encrypted_keys=data.get("encrypted_keys", {}),
            created_at=(
                datetime.fromisoformat(data["created_at"])
                if data.get("created_at")
                else datetime.now(timezone.utc)
            ),
            updated_at=(
                datetime.fromisoformat(data["updated_at"])
                if data.get("updated_at")
                else datetime.now(timezone.utc)
            ),
        )

    async def _invalidate_tenant_config_cache(self, tenant_id: str) -> None:
        """Invalida o cache de configurações do tenant no Redis."""
        try:
            if redis_cache.redis_client:
                await redis_cache.redis_client.delete(f"tenant_config:{tenant_id}")
                logger.info(f"[TenantConfigRepository] Cache do tenant_config '{tenant_id}' invalidado com sucesso.")
        except Exception as err:
            logger.warning(f"[TenantConfigRepository] Falha ao invalidar cache do tenant_config '{tenant_id}': {err}")

    async def get(self, tenant_id: str) -> Optional[TenantConfigModel]:
        """
        Busca configurações do tenant por tenant_id. Tenta do Redis via Cache-Aside;
        se não existir, faz a consulta no banco de dados e armazena em cache.
        """
        cache_key = f"tenant_config:{tenant_id}"

        async def fetch_from_db() -> Optional[Dict[str, Any]]:
            logger.info(f"[TenantConfigRepository] Cache Miss. Buscando tenant_config '{tenant_id}' no banco.")
            session, owned = await self._get_session()
            try:
                stmt = select(TenantConfigModel).where(TenantConfigModel.tenant_id == tenant_id)
                result = await session.execute(stmt)
                model = result.scalar_one_or_none()
                return self._model_to_dict(model) if model else None
            finally:
                if owned:
                    await session.close()

        cached_data = await redis_cache.get_or_create(
            key=cache_key,
            factory=fetch_from_db,
            expire_seconds=self.CACHE_TTL,
        )

        if cached_data and isinstance(cached_data, dict):
            return self._dict_to_model(cached_data)

        return None

    async def get_shopify_credentials(self, tenant_id: str) -> Optional[Tuple[str, str]]:
        """
        Recupera e descriptografa as credenciais do Shopify para o tenant especificado.
        Retorna (shop_domain, decrypted_access_token) ou None se não configurado.
        """
        config = await self.get(tenant_id)
        if not config:
            return None
        tenant_keys = config.encrypted_keys or {}
        shop_domain = tenant_keys.get("shopify_shop_domain")
        raw_token = tenant_keys.get("shopify_access_token")
        if not shop_domain or not raw_token:
            return None
        from app.core.security.crypto import decrypt_api_key
        access_token = decrypt_api_key(raw_token)
        return str(shop_domain), access_token

    async def get_nuvemshop_credentials(self, tenant_id: str) -> Optional[Tuple[str, str, str]]:
        """
        Recupera e descriptografa as credenciais da Nuvemshop para o tenant especificado.
        Retorna (store_id, decrypted_access_token, app_email) ou None se não configurado.
        """
        config = await self.get(tenant_id)
        if not config:
            return None
        tenant_keys = config.encrypted_keys or {}
        store_id = tenant_keys.get("nuvemshop_store_id")
        raw_token = tenant_keys.get("nuvemshop_access_token")
        app_email = tenant_keys.get("email", "suporte@ecommerce-bot.com")
        if not store_id or not raw_token:
            return None
        from app.core.security.crypto import decrypt_api_key
        access_token = decrypt_api_key(raw_token)
        return str(store_id), access_token, str(app_email)

    async def upsert(self, tenant_id: str, encrypted_keys: dict) -> None:
        session, owned = await self._get_session()
        try:
            existing = await session.get(TenantConfigModel, tenant_id)
            if existing is None:
                session.add(TenantConfigModel(tenant_id=tenant_id, encrypted_keys=encrypted_keys))
            else:
                existing.encrypted_keys = encrypted_keys
            await session.commit()

            # Invalida o cache após salvar/atualizar credenciais
            await self._invalidate_tenant_config_cache(tenant_id)
        except Exception:
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()
