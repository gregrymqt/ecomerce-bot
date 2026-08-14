from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.features.settings.schemas import (
    AiSettingsSchema,
    PricingSettingsSchema,
    StoreProfileSchema,
    TenantSettingsResponse,
    TenantSettingsUpdate,
)
from app.features.settings.services.settings_service import SettingsService


@pytest.fixture
def mock_settings_repo():
    return AsyncMock()


@pytest.fixture
def sample_settings_response():
    return TenantSettingsResponse(
        tenant_id="tenant_test_123",
        ai_settings=AiSettingsSchema(
            tone_of_voice="persuasivo",
            target_language="pt-BR",
            seo_tags_enabled=True,
        ),
        pricing_settings=PricingSettingsSchema(
            margin_percentage=15.0,
            round_cents=True,
        ),
        store_profile=StoreProfileSchema(
            store_name="Minha Loja Teste",
            niche="Moda",
            support_email="suporte@loja.com",
        ),
    )


@pytest.mark.asyncio
async def test_get_settings_cache_miss(mock_settings_repo, sample_settings_response):
    mock_settings_repo.get_settings.return_value = sample_settings_response

    with patch("app.core.config.redis_db.redis_cache.get_model", new_callable=AsyncMock) as mock_redis_get, \
         patch("app.core.config.redis_db.redis_cache.set", new_callable=AsyncMock) as mock_redis_set:
        
        mock_redis_get.return_value = None

        service = SettingsService(repository=mock_settings_repo)
        result = await service.get_settings("tenant_test_123")

        assert result.tenant_id == "tenant_test_123"
        assert result.ai_settings.tone_of_voice == "persuasivo"
        assert result.pricing_settings.margin_percentage == 15.0
        mock_settings_repo.get_settings.assert_called_once_with("tenant_test_123")
        mock_redis_set.assert_called_once()


@pytest.mark.asyncio
async def test_get_settings_cache_hit(mock_settings_repo, sample_settings_response):
    with patch("app.core.config.redis_db.redis_cache.get_model", new_callable=AsyncMock) as mock_redis_get:
        mock_redis_get.return_value = sample_settings_response

        service = SettingsService(repository=mock_settings_repo)
        result = await service.get_settings("tenant_test_123")

        assert result.tenant_id == "tenant_test_123"
        assert result.store_profile.store_name == "Minha Loja Teste"
        mock_settings_repo.get_settings.assert_not_called()


@pytest.mark.asyncio
async def test_update_settings_success(mock_settings_repo, sample_settings_response):
    mock_settings_repo.upsert_settings.return_value = sample_settings_response

    update_payload = TenantSettingsUpdate(
        ai_settings=AiSettingsSchema(tone_of_voice="formal")
    )

    with patch("app.core.config.redis_db.redis_cache.delete", new_callable=AsyncMock) as mock_redis_del:
        service = SettingsService(repository=mock_settings_repo)
        result = await service.update_settings("tenant_test_123", update_payload)

        assert result.tenant_id == "tenant_test_123"
        mock_settings_repo.upsert_settings.assert_called_once_with(
            tenant_id="tenant_test_123", update_data=update_payload
        )
        mock_redis_del.assert_called_once_with("settings:tenant_test_123")
