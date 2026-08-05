from datetime import datetime, timezone
import logging
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import AsyncSessionLocal
from app.features.products.domain.models import TenantConfigModel
from app.features.settings.schemas.settings_schemas import (
    AiSettingsSchema,
    PricingSettingsSchema,
    StoreProfileSchema,
    TenantSettingsResponse,
    TenantSettingsUpdate,
)

logger = logging.getLogger(__name__)


class SettingsRepository:
    """
    Repositório assíncrono para gestão de configurações e preferências operacionais do tenant,
    garantindo fallback automático para padrões do sistema e isolamento estrito por tenant_id.
    """

    def __init__(self, session: Optional[AsyncSession] = None):
        self.session = session

    async def _get_session(self) -> Tuple[AsyncSession, bool]:
        if self.session is not None:
            return self.session, False
        session = AsyncSessionLocal()
        return session, True

    def _merge_dict(
        self, base_defaults: Dict[str, Any], current_data: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        result = dict(base_defaults)
        if isinstance(current_data, dict):
            for k, v in current_data.items():
                if v is not None:
                    result[k] = v
        return result

    async def get_settings(self, tenant_id: str) -> TenantSettingsResponse:
        """
        Busca as configurações do tenant por tenant_id. Se o registro não existir ou possuir
        chaves faltantes, aplica o fallback para os padrões do sistema.
        """
        session, owned = await self._get_session()
        try:
            stmt = select(TenantConfigModel).where(TenantConfigModel.tenant_id == tenant_id)
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()

            ai_raw = dict(model.ai_settings or {}) if model else {}
            pricing_raw = dict(model.pricing_settings or {}) if model else {}
            profile_raw = dict(model.store_profile or {}) if model else {}

            ai_defaults = {
                "tone_of_voice": "persuasivo",
                "target_language": "pt-BR",
                "seo_tags_enabled": True,
                "custom_instructions": None,
            }
            pricing_defaults = {
                "margin_percentage": 0.0,
                "round_cents": True,
            }
            profile_defaults = {
                "store_name": None,
                "niche": None,
                "support_email": None,
            }

            ai_merged = self._merge_dict(ai_defaults, ai_raw)
            pricing_merged = self._merge_dict(pricing_defaults, pricing_raw)
            profile_merged = self._merge_dict(profile_defaults, profile_raw)

            updated_at = model.updated_at if model else None

            return TenantSettingsResponse(
                tenant_id=tenant_id,
                ai_settings=AiSettingsSchema(**ai_merged),
                pricing_settings=PricingSettingsSchema(**pricing_merged),
                store_profile=StoreProfileSchema(**profile_merged),
                updated_at=updated_at,
            )
        finally:
            if owned:
                await session.close()

    async def upsert_settings(
        self, tenant_id: str, update_data: TenantSettingsUpdate
    ) -> TenantSettingsResponse:
        """
        Cria ou atualiza as configurações operacionais do tenant de forma incremental.
        """
        session, owned = await self._get_session()
        try:
            stmt = select(TenantConfigModel).where(TenantConfigModel.tenant_id == tenant_id)
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()

            if model is None:
                model = TenantConfigModel(
                    tenant_id=tenant_id,
                    encrypted_keys={},
                    ai_settings={},
                    pricing_settings={},
                    store_profile={},
                )
                session.add(model)

            current_ai = dict(model.ai_settings or {})
            current_pricing = dict(model.pricing_settings or {})
            current_profile = dict(model.store_profile or {})

            if update_data.ai_settings is not None:
                updated_fields = update_data.ai_settings.model_dump(exclude_unset=True)
                current_ai.update(updated_fields)
                model.ai_settings = current_ai

            if update_data.pricing_settings is not None:
                updated_fields = update_data.pricing_settings.model_dump(exclude_unset=True)
                current_pricing.update(updated_fields)
                model.pricing_settings = current_pricing

            if update_data.store_profile is not None:
                updated_fields = update_data.store_profile.model_dump(exclude_unset=True)
                current_profile.update(updated_fields)
                model.store_profile = current_profile

            model.updated_at = datetime.now(timezone.utc)

            await session.commit()
            return await self.get_settings(tenant_id=tenant_id)
        except Exception as e:
            logger.error(f"Erro ao atualizar configurações do tenant '{tenant_id}': {e}")
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()
