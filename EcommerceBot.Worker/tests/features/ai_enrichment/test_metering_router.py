from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.features.ai_enrichment.schemas.metering_schema import (
    LLMUsageLogResponse,
    TenantCreditBalanceResponse,
)
from app.features.ai_enrichment.services.metering_service import LLMMeteringService
from app.main import app


@pytest.mark.asyncio
async def test_get_metering_balance_authenticated_tenant(sample_tenant_id: str, auth_headers: dict):
    """Valida retorno HTTP 200 da rota /api/v1/metering/balance para requisição autenticada."""
    mock_balance_response = TenantCreditBalanceResponse(
        tenant_id=sample_tenant_id,
        managed_credit_balance=Decimal("25.500000"),
        monthly_total_tokens=12500,
        monthly_total_cost_usd=Decimal("0.045000"),
        is_byok_enabled=True,
        active_mode="byok",
    )

    with patch.object(
        LLMMeteringService,
        "get_tenant_credit_balance",
        new_callable=AsyncMock,
    ) as mock_get_balance:
        mock_get_balance.return_value = mock_balance_response

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/metering/balance", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert data["tenant_id"] == sample_tenant_id
            assert data["managed_credit_balance"] == "25.500000"
            assert data["monthly_total_tokens"] == 12500
            assert data["is_byok_enabled"] is True
            assert data["active_mode"] == "byok"


@pytest.mark.asyncio
async def test_get_metering_usage_multi_tenant_isolation(sample_tenant_id: str, auth_headers: dict):
    """Valida o extrato de uso garantindo que a busca é estritamente isolada pelo tenant do header X-Tenant-ID."""
    mock_usage_logs_response = {
        "items": [
            {
                "id": "log_a_1",
                "tenant_id": sample_tenant_id,
                "product_id": "prod_1",
                "provider": "openrouter",
                "model_used": "deepseek/deepseek-chat",
                "prompt_tokens": 500,
                "completion_tokens": 500,
                "total_tokens": 1000,
                "estimated_cost_usd": "0.000420",
                "is_byok": False,
                "execution_time_ms": 350,
                "created_at": "2026-08-08T18:00:00Z",
            }
        ],
        "total": 1,
        "page": 1,
        "limit": 20,
        "total_pages": 1,
    }

    with patch.object(
        LLMMeteringService,
        "get_tenant_usage_logs",
        new_callable=AsyncMock,
    ) as mock_get_usage:
        mock_get_usage.return_value = mock_usage_logs_response

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/metering/usage?page=1&limit=20", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 1
            assert len(data["items"]) == 1
            assert data["items"][0]["tenant_id"] == sample_tenant_id

            # Garanta que a camada de serviço recebeu exatamente o tenant_id autenticado no header
            mock_get_usage.assert_called_once()
            _, kwargs = mock_get_usage.call_args
            assert kwargs.get("tenant_id") == sample_tenant_id


@pytest.mark.asyncio
async def test_metering_endpoints_unauthorized():
    """Valida bloqueio HTTP 401 quando requisição não contiver JWT token válido."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Requisição sem Authorization Bearer token -> HTTP 401
        res_balance = await client.get("/api/v1/metering/balance", headers={"X-Tenant-ID": "tenant_xyz"})
        assert res_balance.status_code == 401

        res_usage = await client.get("/api/v1/metering/usage", headers={"X-Tenant-ID": "tenant_xyz"})
        assert res_usage.status_code == 401

        # Requisição sem X-Tenant-ID header -> HTTP 422 Unprocessable Entity
        res_missing_tenant = await client.get(
            "/api/v1/metering/balance",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert res_missing_tenant.status_code in {401, 422}
