import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.redis_db import redis_cache
from app.features.settings.repositories.settings_repository import SettingsRepository
from app.features.settings.schemas.settings_schemas import (
    TenantSettingsResponse,
    TenantSettingsUpdate,
)

logger = logging.getLogger(__name__)


class SettingsService:
    """
    Serviço de aplicação para gestão de preferências do tenant com suporte a cache Redis
    com estratégia Cache-Aside (TTL 1h) e invalidação imediata no salvamento (PUT).
    """

    def __init__(
        self,
        repository: Optional[SettingsRepository] = None,
        session: Optional[AsyncSession] = None,
    ):
        self.repository = repository or SettingsRepository(session=session)

    async def get_settings(self, tenant_id: str) -> TenantSettingsResponse:
        """
        Recupera as configurações do tenant utilizando Cache-Aside do Redis (TTL 3600s).
        """
        cache_key = f"settings:{tenant_id}"
        try:
            cached = await redis_cache.get_model(cache_key, TenantSettingsResponse)
            if cached is not None:
                logger.info(f"Hit de cache Redis para configurações do tenant '{tenant_id}'")
                return cached
        except Exception as err:
            logger.warning(f"Falha ao ler cache Redis de settings para tenant '{tenant_id}': {err}")

        logger.info(f"Miss de cache Redis. Buscando configurações do tenant '{tenant_id}' no banco.")
        settings_data = await self.repository.get_settings(tenant_id)

        try:
            await redis_cache.set(cache_key, settings_data, expire_seconds=3600)
        except Exception as err:
            logger.warning(f"Falha ao gravar cache Redis de settings para tenant '{tenant_id}': {err}")

        return settings_data

    async def update_settings(
        self, tenant_id: str, data: TenantSettingsUpdate
    ) -> TenantSettingsResponse:
        """
        Atualiza as configurações do tenant no banco e invalida o cache Redis.
        """
        cache_key = f"settings:{tenant_id}"
        updated_settings = await self.repository.upsert_settings(
            tenant_id=tenant_id, update_data=data
        )

        try:
            await redis_cache.delete(cache_key)
            logger.info(f"Cache Redis de configurações do tenant '{tenant_id}' invalidado com sucesso.")
        except Exception as err:
            logger.warning(f"Falha ao invalidar cache Redis de settings para tenant '{tenant_id}': {err}")

        return updated_settings
