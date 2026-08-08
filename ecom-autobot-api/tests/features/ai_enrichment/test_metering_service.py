from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.features.ai_enrichment.domain.exceptions import InsufficientCreditsException
from app.features.ai_enrichment.domain.models import LLMUsageLogModel
from app.features.ai_enrichment.repositories.metering_repository import (
    LLMMeteringRepository,
)
from app.features.ai_enrichment.schemas.metering_schema import LLMUsageLogCreate
from app.features.ai_enrichment.services.metering_service import LLMMeteringService


@pytest.mark.asyncio
async def test_calculate_token_cost_supported_models():
    """Valida a precisão dos cálculos de custo de token para modelos suportados e fallback."""
    mock_db = AsyncMock()
    service = LLMMeteringService(db=mock_db)

    # 1. DeepSeek Chat: prompt 0.000140/1k + completion 0.000280/1k
    cost_ds = service.calculate_token_cost("deepseek/deepseek-chat", 1000, 1000)
    assert cost_ds == Decimal("0.000420")

    # 2. LLaMA 3.3 70B Instruct: prompt (5000/1000)*0.000120 + completion (2000/1000)*0.000300
    cost_llama = service.calculate_token_cost("meta-llama/llama-3.3-70b-instruct", 5000, 2000)
    assert cost_llama == Decimal("0.001200")

    # 3. Gemini Flash 1.5: prompt (2000/1000)*0.000075 + completion (1000/1000)*0.000300
    cost_gemini = service.calculate_token_cost("google/gemini-flash-1.5", 2000, 1000)
    assert cost_gemini == Decimal("0.000450")

    # 4. DeepSeek R1: prompt (1000/1000)*0.000550 + completion (1000/1000)*0.002190
    cost_r1 = service.calculate_token_cost("deepseek/deepseek-r1", 1000, 1000)
    assert cost_r1 == Decimal("0.002740")

    # 5. Gemini 2.0 Flash: prompt (1000/1000)*0.000100 + completion (1000/1000)*0.000400
    cost_gemini2 = service.calculate_token_cost("google/gemini-2.0-flash-001", 1000, 1000)
    assert cost_gemini2 == Decimal("0.000500")

    # 6. Modelo Desconhecido (Fallback default): prompt 0.000200/1k + completion 0.000500/1k
    cost_default = service.calculate_token_cost("unknown-model-xyz", 1000, 1000)
    assert cost_default == Decimal("0.000700")


@pytest.mark.asyncio
async def test_check_tenant_credits_managed_sufficient_and_insufficient():
    """Valida verificação de saldo suficiente (retorna True) e insuficiente (lança HTTP 402)."""
    mock_repo = AsyncMock(spec=LLMMeteringRepository)
    mock_db = AsyncMock()

    service = LLMMeteringService(db=mock_db, repository=mock_repo)

    # Cenário A: Saldo suficiente
    mock_repo.get_managed_credit_balance.return_value = Decimal("10.000000")
    res = await service.check_tenant_credits("tenant_123", required_credits=Decimal("1.000000"), is_byok=False)
    assert res is True

    # Cenário B: Saldo insuficiente -> lança InsufficientCreditsException (HTTP 402)
    mock_repo.get_managed_credit_balance.return_value = Decimal("0.000000")
    with pytest.raises(InsufficientCreditsException) as exc_info:
        await service.check_tenant_credits("tenant_123", required_credits=Decimal("1.000000"), is_byok=False)

    assert exc_info.value.status_code == 402
    assert "Saldo insuficiente de créditos" in exc_info.value.detail


@pytest.mark.asyncio
async def test_check_tenant_credits_byok_bypass():
    """Garanta que no modo BYOK (is_byok=True) a checagem retorna True sem consultar saldo ou bloquear."""
    mock_repo = AsyncMock(spec=LLMMeteringRepository)
    mock_db = AsyncMock()

    service = LLMMeteringService(db=mock_db, repository=mock_repo)

    # Saldo zerado no repositório
    mock_repo.get_managed_credit_balance.return_value = Decimal("0.000000")

    res = await service.check_tenant_credits("tenant_byok", required_credits=Decimal("5.000000"), is_byok=True)
    assert res is True

    # Confirma que get_managed_credit_balance nem sequer foi chamado
    mock_repo.get_managed_credit_balance.assert_not_called()


@pytest.mark.asyncio
async def test_record_usage_and_deduct_managed_atomic():
    """Verifica a gravação do log de uso e execução do débito atômico para modo Gerenciado (is_byok=False)."""
    mock_repo = AsyncMock(spec=LLMMeteringRepository)
    mock_db = AsyncMock()

    service = LLMMeteringService(db=mock_db, repository=mock_repo)
    mock_repo.atomic_deduct_credits.return_value = True

    dummy_log = LLMUsageLogModel(
        id="log_123",
        tenant_id="tenant_managed",
        provider="openrouter",
        model_used="deepseek/deepseek-chat",
        prompt_tokens=1000,
        completion_tokens=1000,
        total_tokens=2000,
        estimated_cost_usd=Decimal("0.000420"),
        is_byok=False,
    )
    mock_repo.create_usage_log.return_value = dummy_log

    usage_dto = LLMUsageLogCreate(
        tenant_id="tenant_managed",
        provider="openrouter",
        model_used="deepseek/deepseek-chat",
        prompt_tokens=1000,
        completion_tokens=1000,
        total_tokens=2000,
        estimated_cost_usd=Decimal("0.000420"),
        is_byok=False,
    )

    result = await service.record_usage_and_deduct("tenant_managed", usage_dto)

    assert result.tenant_id == "tenant_managed"
    mock_repo.create_usage_log.assert_called_once()
    mock_repo.atomic_deduct_credits.assert_called_once_with(
        tenant_id="tenant_managed",
        cost=Decimal("0.000420")
    )


@pytest.mark.asyncio
async def test_record_usage_byok_no_deduct():
    """Verifica que ao registrar log com is_byok=True o log é gravado mas NENHUM débito atômico é executado."""
    mock_repo = AsyncMock(spec=LLMMeteringRepository)
    mock_db = AsyncMock()

    service = LLMMeteringService(db=mock_db, repository=mock_repo)

    dummy_log = LLMUsageLogModel(
        id="log_byok_123",
        tenant_id="tenant_byok",
        provider="openrouter",
        model_used="meta-llama/llama-3.3-70b-instruct",
        prompt_tokens=1000,
        completion_tokens=1000,
        total_tokens=2000,
        estimated_cost_usd=Decimal("0.000420"),
        is_byok=True,
    )
    mock_repo.create_usage_log.return_value = dummy_log

    usage_dto = LLMUsageLogCreate(
        tenant_id="tenant_byok",
        provider="openrouter",
        model_used="meta-llama/llama-3.3-70b-instruct",
        prompt_tokens=1000,
        completion_tokens=1000,
        total_tokens=2000,
        estimated_cost_usd=Decimal("0.000420"),
        is_byok=True,
    )

    result = await service.record_usage_and_deduct("tenant_byok", usage_dto)

    assert result.is_byok is True
    mock_repo.create_usage_log.assert_called_once()
    mock_repo.atomic_deduct_credits.assert_not_called()
