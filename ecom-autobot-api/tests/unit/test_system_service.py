from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.features.system.schemas import (
    DashboardTelemetryResponse,
    ProductStatusSummary,
    TokenTelemetrySchema,
)
from app.features.system.services.system_service import SystemService


@pytest.fixture
def mock_telemetry_repo():
    repo = AsyncMock()
    repo.get_product_status_counts.return_value = ProductStatusSummary(
        raw=10, processing=2, processed=50, failed=1
    )
    repo.get_token_usage_by_provider.return_value = [
        TokenTelemetrySchema(
            provider="openrouter",
            total_prompt_tokens=1000,
            total_completion_tokens=500,
            total_tokens=1500,
        )
    ]
    repo.get_average_latency.return_value = 1250.5
    return repo


@pytest.mark.asyncio
async def test_get_telemetry_metrics_cache_miss(mock_telemetry_repo):
    with patch("app.core.config.redis_db.redis_cache.get_model", new_callable=AsyncMock) as mock_redis_get, \
         patch("app.core.config.redis_db.redis_cache.set", new_callable=AsyncMock) as mock_redis_set:

        mock_redis_get.return_value = None

        service = SystemService(telemetry_repo=mock_telemetry_repo)
        result = await service.get_telemetry_metrics("tenant_sys_123", timeframe="24h")

        assert isinstance(result, DashboardTelemetryResponse)
        assert result.status_summary.processed == 50
        assert result.hours_saved == 12.5  # 50 * 0.25
        assert result.average_latency_ms == 1250.5

        mock_telemetry_repo.get_product_status_counts.assert_called_once()
        mock_redis_set.assert_called_once()


@pytest.mark.asyncio
async def test_get_telemetry_metrics_cache_hit(mock_telemetry_repo):
    cached_response = DashboardTelemetryResponse(
        status_summary=ProductStatusSummary(raw=5, processing=0, processed=100, failed=0),
        tokens_by_provider=[],
        average_latency_ms=800.0,
        hours_saved=25.0,
    )

    with patch("app.core.config.redis_db.redis_cache.get_model", new_callable=AsyncMock) as mock_redis_get:
        mock_redis_get.return_value = cached_response

        service = SystemService(telemetry_repo=mock_telemetry_repo)
        result = await service.get_telemetry_metrics("tenant_sys_123", timeframe="7d")

        assert result.hours_saved == 25.0
        mock_telemetry_repo.get_product_status_counts.assert_not_called()


@pytest.mark.asyncio
async def test_check_system_health():
    with patch("app.features.system.services.system_service.AsyncSessionLocal") as mock_db_session_factory, \
         patch("app.core.config.redis_db.redis_cache.redis_client") as mock_redis_client, \
         patch("app.features.system.services.system_service.get_rabbitmq_connection", new_callable=AsyncMock) as mock_rmq:

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = 1
        mock_session.execute.return_value = mock_result
        mock_db_session_factory.return_value.__aenter__.return_value = mock_session

        mock_redis_client.ping = AsyncMock()

        mock_conn = MagicMock()
        mock_conn.is_closed = False
        mock_rmq.return_value = mock_conn

        health = await SystemService.check_system_health()

        assert health.database is True
        assert health.redis is True
        assert health.rabbitmq is True
        assert health.status == "ok"
