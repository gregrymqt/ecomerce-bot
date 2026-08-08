from datetime import datetime
from decimal import Decimal
import logging
from math import ceil
from typing import Dict, Optional, Union
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import get_db
from app.features.ai_enrichment.domain.exceptions import InsufficientCreditsException
from app.features.ai_enrichment.domain.models import LLMUsageLogModel
from app.features.ai_enrichment.repositories.metering_repository import (
    LLMMeteringRepository,
)
from app.features.ai_enrichment.schemas.metering_schema import (
    LLMUsageLogCreate,
    LLMUsageLogResponse,
    PaginatedLLMUsageLogResponse,
    TenantCreditBalanceResponse,
)

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
    """Serviço de aplicação responsável pelas regras de metrificação de tokens, tarifação de LLM e saldo."""

    def __init__(self, db: AsyncSession, repository: Optional[LLMMeteringRepository] = None):
        self.db = db
        self.repository = repository or LLMMeteringRepository(session=db)

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
        Caso contrário, faz uma leitura rápida do saldo sem bloquear a linha
        (leitura otimista para checagem de elegibilidade). Para a reserva real antes
        de chamar a LLM, utilize `reserve_credits_for_llm()`.
        """
        if is_byok:
            return True

        req_dec = Decimal(str(required_credits))
        balance = await self.repository.get_managed_credit_balance(tenant_id=tenant_id)
        try:
            current_balance = Decimal(str(balance)) if balance is not None else Decimal("1.000000")
        except Exception as conv_err:
            logger.warning(
                f"[LLMMeteringService] Falha ao converter saldo '{balance}' para Decimal para tenant '{tenant_id}': {conv_err}"
            )
            current_balance = Decimal("999999.000000")

        if current_balance < req_dec:
            logger.warning(
                f"[LLMMeteringService] Saldo insuficiente para tenant '{tenant_id}': "
                f"saldo={current_balance} USD, necessário={req_dec} USD"
            )
            raise InsufficientCreditsException()

        return True

    async def reserve_credits_for_llm(
        self,
        tenant_id: str,
        estimated_cost: Decimal,
    ) -> bool:
        """
        Pré-reserva pessimista de créditos antes de chamar o provedor de LLM.

        Usa SELECT FOR UPDATE SKIP LOCKED no PostgreSQL para garantir que nenhuma
        requisição concorrente do mesmo tenant ultrapasse o limite de saldo disponível.

        Retorna:
            True  — reserva efetuada com sucesso; o caller deve prosseguir com a LLM.
            False — saldo insuficiente ou linha bloqueada; o caller deve abortar e
                    lançar InsufficientCreditsException.
        """
        reserved = await self.repository.atomic_reserve_credits(
            tenant_id=tenant_id, estimated_cost=estimated_cost
        )
        if not reserved:
            logger.warning(
                f"[LLMMeteringService] Reserva de créditos negada para tenant '{tenant_id}'. "
                f"Saldo insuficiente ou linha em uso por outro worker (estimado={estimated_cost} USD)."
            )
            raise InsufficientCreditsException()

        await self.db.commit()
        logger.debug(
            f"[LLMMeteringService] Reserva de {estimated_cost} USD confirmada para tenant '{tenant_id}'."
        )
        return True

    async def refund_credits_on_failure(
        self,
        tenant_id: str,
        reserved_cost: Decimal,
    ) -> None:
        """
        Estorna créditos pré-reservados quando a chamada ao provedor de LLM falha.

        Deve ser chamado no bloco `except` do ProcessorWorker após uma falha de
        infraestrutura (timeout, erro 5xx, AllProvidersExhaustedError) para
        garantir que o tenant não seja cobrado por uma execução que não completou.
        """
        try:
            await self.repository.atomic_refund_credits(
                tenant_id=tenant_id, amount=reserved_cost
            )
            await self.db.commit()
            logger.info(
                f"[LLMMeteringService] Estorno de {reserved_cost} USD realizado para tenant '{tenant_id}' "
                f"após falha do provedor de LLM."
            )
        except Exception as refund_err:
            logger.error(
                f"[LLMMeteringService] FALHA CRÍTICA no estorno de créditos para tenant '{tenant_id}': "
                f"{refund_err}. Intervenção manual pode ser necessária."
            )

    async def record_usage_and_deduct(
        self,
        tenant_id: str,
        usage_dto: LLMUsageLogCreate,
        reserved_cost: Optional[Decimal] = None,
    ) -> LLMUsageLogModel:
        """Registra a chamada de LLM no repositório e acerta o saldo final.

        Quando `reserved_cost` é fornecido (modo LLM gerenciado com pré-reserva),
        chama `atomic_settle_credits` para ajustar a diferença entre o custo estimado
        na reserva e o custo real consumido (estorno parcial ou débito complementar).

        Quando `reserved_cost` é None, recai no débito atômico legado para
        compatibilidade com fluxos não-concorrentes.
        """
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

        saved_log = await self.repository.create_usage_log(log_model)

        if not usage_dto.is_byok and cost > Decimal("0.000000"):
            if reserved_cost is not None:
                # Modo concorrente: acerta a diferença entre reserva e consumo real
                await self.repository.atomic_settle_credits(
                    tenant_id=tenant_id,
                    reserved_cost=reserved_cost,
                    actual_cost=cost,
                )
            else:
                # Modo legado: débito atômico direto (sem pré-reserva)
                success = await self.repository.atomic_deduct_credits(tenant_id=tenant_id, cost=cost)
                if not success:
                    logger.warning(
                        f"[LLMMeteringService] Débito atômico não realizado para tenant '{tenant_id}'. "
                        f"Saldo insuficiente para debitar {cost} USD no registro de uso."
                    )

        return saved_log


    async def get_tenant_credit_balance(
        self,
        tenant_id: str,
    ) -> TenantCreditBalanceResponse:
        """Recupera o extrato e saldo atual do tenant consultando o repositório."""
        config = await self.repository.get_tenant_config(tenant_id=tenant_id)

        balance = config.managed_credit_balance if (config and config.managed_credit_balance is not None) else Decimal("0.000000")
        has_byok = False
        if config and config.encrypted_keys:
            has_byok = bool(config.encrypted_keys.get("openrouter_api_key"))

        monthly_tokens, monthly_cost = await self.repository.get_monthly_telemetry(tenant_id=tenant_id)
        active_mode = "byok" if has_byok else "managed"

        return TenantCreditBalanceResponse(
            tenant_id=tenant_id,
            managed_credit_balance=balance,
            monthly_total_tokens=monthly_tokens,
            monthly_total_cost_usd=monthly_cost,
            is_byok_enabled=has_byok,
            active_mode=active_mode,
        )

    async def get_tenant_usage_logs(
        self,
        tenant_id: str,
        page: int = 1,
        limit: int = 20,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> PaginatedLLMUsageLogResponse:
        """Recupera o extrato paginado de logs de consumo do tenant."""
        logs, total_items = await self.repository.get_usage_logs_paginated(
            tenant_id=tenant_id,
            page=page,
            limit=limit,
            start_date=start_date,
            end_date=end_date,
        )

        items = [LLMUsageLogResponse.model_validate(log) for log in logs]
        total_pages = ceil(total_items / limit) if total_items > 0 else 1

        return PaginatedLLMUsageLogResponse(
            items=items,
            total=total_items,
            page=page,
            limit=limit,
            total_pages=total_pages,
        )


def get_llm_metering_service(db: AsyncSession = Depends(get_db)) -> LLMMeteringService:
    """Factory helper para injeção de dependência do FastAPI e dos workers."""
    return LLMMeteringService(db=db)
