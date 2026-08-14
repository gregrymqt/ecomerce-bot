from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional, Tuple

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
            "ai_settings": model.ai_settings or {},
            "pricing_settings": model.pricing_settings or {},
            "store_profile": model.store_profile or {},
            "updated_at": model.updated_at.isoformat() if hasattr(model, "updated_at") and model.updated_at else None,
        }

    def _dict_to_model(self, data: Dict[str, Any]) -> TenantConfigModel:
        """Reconstrói um TenantConfigModel a partir de dicionário recuperado do cache."""
        return TenantConfigModel(
            tenant_id=data["tenant_id"],
            encrypted_keys=data.get("encrypted_keys", {}),
            ai_settings=data.get("ai_settings", {}),
            pricing_settings=data.get("pricing_settings", {}),
            store_profile=data.get("store_profile", {}),
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

    async def get_openrouter_byok_key(self, tenant_id: str) -> Optional[str]:
        """
        Recupera e descriptografa a chave BYOK do OpenRouter para o tenant especificado (se configurada).
        Retorna a chave em texto plano ou None se não configurada ou inválida.
        """
        config = await self.get(tenant_id)
        if not config:
            return None
        tenant_keys = config.encrypted_keys or {}
        raw_key = tenant_keys.get("openrouter_api_key")
        if not raw_key:
            return None
        from app.core.security.crypto import decrypt_api_key
        try:
            decrypted_key = decrypt_api_key(raw_key)
            return decrypted_key if decrypted_key else None
        except Exception as err:
            logger.warning(f"[TenantConfigRepository] Falha ao descriptografar openrouter_api_key para tenant '{tenant_id}': {err}")
            return None

    async def upsert(
        self,
        tenant_id: str,
        encrypted_keys: dict,
        ai_settings: Optional[dict] = None,
        pricing_settings: Optional[dict] = None,
        store_profile: Optional[dict] = None,
    ) -> None:
        session, owned = await self._get_session()
        try:
            existing = await session.get(TenantConfigModel, tenant_id)
            if existing is None:
                session.add(
                    TenantConfigModel(
                        tenant_id=tenant_id,
                        encrypted_keys=encrypted_keys,
                        ai_settings=ai_settings if ai_settings is not None else {},
                        pricing_settings=pricing_settings if pricing_settings is not None else {},
                        store_profile=store_profile if store_profile is not None else {},
                    )
                )
            else:
                existing.encrypted_keys = encrypted_keys
                if ai_settings is not None:
                    existing.ai_settings = ai_settings
                if pricing_settings is not None:
                    existing.pricing_settings = pricing_settings
                if store_profile is not None:
                    existing.store_profile = store_profile
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

    async def update_store_locations(self, tenant_id: str, locations: List[dict]) -> None:
        """
        Atualiza em tempo real a lista de depósitos/localizações no store_profile do TenantConfigModel no PostgreSQL.
        """
        session, owned = await self._get_session()
        try:
            existing = await session.get(TenantConfigModel, tenant_id)
            if existing:
                profile = dict(existing.store_profile or {})
                profile["nuvemshop_locations"] = locations
                existing.store_profile = profile
                await session.commit()
                await self._invalidate_tenant_config_cache(tenant_id)
        except Exception:
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()

    async def get_tenant_id_by_nuvemshop_store_id(self, store_id: str) -> Optional[str]:
        """
        Busca o tenant_id proprietário do nuvemshop_store_id especificado.
        """
        cache_key = f"nuvemshop_store_tenant:{store_id}"
        try:
            cached_tenant = await redis_cache.get(cache_key)
            if cached_tenant:
                return str(cached_tenant)
        except Exception:
            pass

        session, owned = await self._get_session()
        try:
            stmt = select(TenantConfigModel)
            result = await session.execute(stmt)
            models = result.scalars().all()
            for model in models:
                keys = model.encrypted_keys or {}
                ns_store = str(keys.get("nuvemshop_store_id", ""))
                if ns_store == str(store_id):
                    try:
                        await redis_cache.set(cache_key, model.tenant_id, expire_seconds=self.CACHE_TTL)
                    except Exception:
                        pass
                    return model.tenant_id
            return None
        finally:
            if owned:
                await session.close()

    async def deactivate_nuvemshop_integration(self, tenant_id: str) -> bool:
        """
        Desativa as credenciais da Nuvemshop para o tenant (ex: em evento de app/uninstalled).
        """
        session, owned = await self._get_session()
        try:
            existing = await session.get(TenantConfigModel, tenant_id)
            if existing and existing.encrypted_keys:
                keys = dict(existing.encrypted_keys)
                keys.pop("nuvemshop_access_token", None)
                keys["is_active"] = False
                existing.encrypted_keys = keys
                await session.commit()
                await self._invalidate_tenant_config_cache(tenant_id)
                return True
            return False
        except Exception:
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()


