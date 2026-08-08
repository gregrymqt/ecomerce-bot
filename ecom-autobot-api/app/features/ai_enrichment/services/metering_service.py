from decimal import Decimal
import logging
from typing import Any, Dict, Optional, Union
from fastapi import Depends
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import get_db
from app.features.ai_enrichment.domain.exceptions import InsufficientCreditsException
from app.features.ai_enrichment.domain.models import LLMUsageLogModel
from app.features.ai_enrichment.schemas.metering_schema import (
    LLMUsageLogCreate,
    LLMUsageLogResponse,
    TenantCreditBalanceResponse,
)
from app.features.products.domain.models import TenantConfigModel

logger = logging.getLogger(__name__)

# Tabela de preços base por 1.000 tokens (USD)
PRICING_TABLE: Dict[str, Dict[str, Decimal]] = {
    "deepseek/deepseek-chat": {
        "prompt": Decimal("0.000140"),
        "completion": Decimal("0.000280"),
    },
    "deepseek/deepseek-r1": {
        "prompt": Decimal("0.000550"),
        "completion": Decimal("0.002190"),
    },
    "meta-llama/llama-3.3-70b-instruct": {
        "prompt": Decimal("0.000120"),
        "completion": Decimal("0.000300"),
    },
    "google/gemini-flash-1.5": {
        "prompt": Decimal("0.000075"),
        "completion": Decimal("0.000300"),
    },
    "google/gemini-2.0-flash-001": {
        "prompt": Decimal("0.000100"),
        "completion": Decimal("0.000400"),
    },
    "default": {
        "prompt": Decimal("0.000200"),
        "completion": Decimal("0.000500"),
    },
}


class LLMMeteringService:
    """Serviço central de metrificação de tokens, tarifação de LLM e gestão de créditos."""

    def __init__(self, db: AsyncSession):
        self.db = db

    def calculate_token_cost(
        self,
        model_used: str,
        prompt_tokens: int,
        completion_tokens: int,
    ) -> Decimal:
        """Calcula o custo estimado em USD com base no modelo utilizado e na contagem de tokens."""
        pricing = PRICING_TABLE.get(model_used, PRICING_TABLE["default"])

        prompt_cost = (Decimal(prompt_tokens) / Decimal(1000)) * pricing["prompt"]
        completion_cost = (Decimal(completion_tokens) / Decimal(1000)) * pricing["completion"]
        total_cost = (prompt_cost + completion_cost).quantize(Decimal("0.000001"))

        return total_cost

    async def check_tenant_credits(
        self,
        tenant_id: str,
        required_credits: Union[Decimal, float, int] = Decimal("0.000001"),
        is_byok: bool = False,
    ) -> bool:
        """Verifica se o tenant possui saldo suficiente de créditos gerenciados.

        Se is_byok for True, retorna True imediatamente (bypass de créditos do sistema).
        Caso contrário, consulta managed_credit_balance em tenant_configs e lança InsufficientCreditsException se insuficiente.
        """
        if is_byok:
            return True

        req_dec = Decimal(str(required_credits))

        stmt = select(TenantConfigModel.managed_credit_balance).where(
            TenantConfigModel.tenant_id == tenant_id
        )
        result = await self.db.execute(stmt)
        balance = result.scalar_one_or_none()

        current_balance = Decimal(str(balance)) if balance is not None else Decimal("0.000000")

        if current_balance < req_dec:
            logger.warning(
                f"[LLMMeteringService] Saldo insuficiente para tenant '{tenant_id}': "
                f"saldo={current_balance} USD, necessário={req_dec} USD"
            )
            raise InsufficientCreditsException()

        return True

    async def record_usage_and_deduct(
        self,
        tenant_id: str,
        usage_dto: LLMUsageLogCreate,
    ) -> LLMUsageLogModel:
        """Registra a chamada de LLM na tabela llm_usage_logs e efetua o débito atômico do saldo se modo Gerenciado."""
        cost = usage_dto.estimated_cost_usd
        if cost == Decimal("0.000000") and (usage_dto.prompt_tokens > 0 or usage_dto.completion_tokens > 0):
            cost = self.calculate_token_cost(
                model_used=usage_dto.model_used,
                prompt_tokens=usage_dto.prompt_tokens,
                completion_tokens=usage_dto.completion_tokens,
            )

        log_model = LLMUsageLogModel(
            tenant_id=tenant_id,
            product_id=usage_dto.product_id,
            provider=usage_dto.provider,
            model_used=usage_dto.model_used,
            prompt_tokens=usage_dto.prompt_tokens,
            completion_tokens=usage_dto.completion_tokens,
            total_tokens=usage_dto.total_tokens or (usage_dto.prompt_tokens + usage_dto.completion_tokens),
            estimated_cost_usd=cost,
            is_byok=usage_dto.is_byok,
            execution_time_ms=usage_dto.execution_time_ms,
        )
        self.db.add(log_model)

        if not usage_dto.is_byok and cost > Decimal("0.000000"):
            stmt = (
                update(TenantConfigModel)
                .where(
                    TenantConfigModel.tenant_id == tenant_id,
                    TenantConfigModel.managed_credit_balance >= cost,
                )
                .values(
                    managed_credit_balance=TenantConfigModel.managed_credit_balance - cost
                )
            )
            res = await self.db.execute(stmt)
            if res.rowcount == 0:
                logger.warning(
                    f"[LLMMeteringService] Débito atômico não realizado para tenant '{tenant_id}'. "
                    f"Saldo insuficiente para debitar {cost} USD no registro de uso."
                )

        await self.db.flush()
        return log_model

    async def get_tenant_credit_balance(
        self,
        tenant_id: str,
    ) -> TenantCreditBalanceResponse:
        """Recupera o extrato e saldo atual do tenant."""
        stmt = select(TenantConfigModel).where(TenantConfigModel.tenant_id == tenant_id)
        res = await self.db.execute(stmt)
        config = res.scalar_one_or_none()

        balance = config.managed_credit_balance if (config and config.managed_credit_balance is not None) else Decimal("0.000000")
        has_byok = False
        if config and config.encrypted_keys:
            has_byok = bool(config.encrypted_keys.get("openrouter_api_key"))

        first_day_of_month = func.date_trunc('month', func.now())

        monthly_stmt = select(
            func.coalesce(func.sum(LLMUsageLogModel.total_tokens), 0),
            func.coalesce(func.sum(LLMUsageLogModel.estimated_cost_usd), 0),
        ).where(
            LLMUsageLogModel.tenant_id == tenant_id,
            LLMUsageLogModel.created_at >= first_day_of_month,
        )
        monthly_res = await self.db.execute(monthly_stmt)
        row = monthly_res.one()
        monthly_tokens, monthly_cost = row[0], row[1]

        active_mode = "byok" if has_byok else "managed"

        return TenantCreditBalanceResponse(
            tenant_id=tenant_id,
            managed_credit_balance=balance,
            monthly_total_tokens=int(monthly_tokens),
            monthly_total_cost_usd=Decimal(str(monthly_cost)),
            is_byok_enabled=has_byok,
            active_mode=active_mode,
        )


def get_llm_metering_service(db: AsyncSession = Depends(get_db)) -> LLMMeteringService:
    """Factory helper para injeção de dependência do FastAPI e dos workers."""
    return LLMMeteringService(db=db)
