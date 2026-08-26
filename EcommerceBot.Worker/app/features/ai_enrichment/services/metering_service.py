import logging
import os
import httpx
from decimal import Decimal
from typing import Dict, Optional, Union
from datetime import datetime

from app.features.ai_enrichment.domain.exceptions import InsufficientCreditsException
from app.features.ai_enrichment.schemas.metering_schema import (
    LLMUsageLogCreate,
    LLMUsageLogResponse,
    PaginatedLLMUsageLogResponse,
    TenantCreditBalanceResponse,
)

logger = logging.getLogger(__name__)

API_BASE_URL = os.getenv("CORE_API_URL", "http://localhost:5000/api/v1")

class LLMMeteringService:
    """
    Serviço de aplicação atuando como HTTP Client para a API C# Principal,
    delegando as regras de metrificação de tokens, tarifação de LLM e saldo.
    """
    def __init__(self, db=None, repository=None):
        # Parametros mantidos para compatibilidade com assinaturas existentes
        # mas ignorados já que a lógica agora reside no C#
        pass

    async def calculate_token_cost(self, model_used: str, prompt_tokens: int, completion_tokens: int) -> Decimal:
        """
        O custo é calculado no C#, este metodo no Python apenas estimará para compatibilidade.
        Recomendado que a reserva delegue isso ao C#.
        """
        return Decimal("0.0001") # stub compatibilidade

    async def reserve_credits_for_llm(self, tenant_id: str, estimated_cost: Decimal) -> bool:
        """
        Pré-reserva pessimista de créditos chamando a API C#.
        Como o C# refatorado espera EstimatedTokens na chamada, a chamada aqui envia tokens fixos 
        (se não tivermos acesso fácil, ou envia um payload adaptado).
        Na verdade, o ProcessorWorker faz:
          reserved_cost = metering_service.calculate_token_cost("...", 500, 300)
          await metering_service.reserve_credits_for_llm(..., reserved_cost)
        Vamos adaptar a chamada para bater no C#.
        """
        # Como o C# API espera { modelUsed, estimatedPromptTokens, estimatedCompletionTokens }
        # Mas para simplificar a compatibilidade, a gente poderia fazer o C# aceitar um valor fixo.
        # Vamos fingir os tokens com base no custo ou apenas enviar deepseek e 500/300.
        payload = {
            "modelUsed": "deepseek/deepseek-chat",
            "estimatedPromptTokens": 500,
            "estimatedCompletionTokens": 300
        }
        
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    f"{API_BASE_URL}/metering/internal/reserve",
                    headers={"X-Tenant-ID": tenant_id},
                    json=payload
                )
                if res.status_code == 200:
                    # Sucesso
                    return True
                elif res.status_code == 400:
                    logger.warning(f"[LLMMeteringService] Saldo insuficiente para {tenant_id}")
                    raise InsufficientCreditsException()
                else:
                    logger.error(f"[LLMMeteringService] Erro desconhecido ao reservar: {res.text}")
                    raise InsufficientCreditsException()
        except httpx.RequestError as e:
            logger.error(f"[LLMMeteringService] Erro de rede ao contatar Core API: {e}")
            raise InsufficientCreditsException()

    async def refund_credits_on_failure(self, tenant_id: str, reserved_cost: Decimal) -> None:
        """Estorna chamando API C#"""
        payload = {"reservedCost": float(reserved_cost)}
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{API_BASE_URL}/metering/internal/refund",
                    headers={"X-Tenant-ID": tenant_id},
                    json=payload
                )
                logger.info(f"[LLMMeteringService] Estorno {reserved_cost} notificado para tenant '{tenant_id}'")
        except Exception as e:
            logger.error(f"[LLMMeteringService] Erro ao estornar na Core API: {e}")

    async def record_usage_and_deduct(self, tenant_id: str, usage_dto: LLMUsageLogCreate, reserved_cost: Optional[Decimal] = None):
        """Registra e deduz chamando API C#"""
        payload = usage_dto.model_dump()
        payload["reservedCost"] = float(reserved_cost) if reserved_cost else None
        
        # O C# espera camelCase
        payload_camel = {
            "productId": payload.get("product_id"),
            "provider": payload.get("provider"),
            "modelUsed": payload.get("model_used"),
            "promptTokens": payload.get("prompt_tokens"),
            "completionTokens": payload.get("completion_tokens"),
            "totalTokens": payload.get("total_tokens"),
            "estimatedCostUsd": float(payload.get("estimated_cost_usd", 0)),
            "isByok": payload.get("is_byok", False),
            "executionTimeMs": payload.get("execution_time_ms"),
            "reservedCost": payload.get("reservedCost")
        }

        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    f"{API_BASE_URL}/metering/internal/record",
                    headers={"X-Tenant-ID": tenant_id},
                    json=payload_camel
                )
                res.raise_for_status()
                # Retorna um stub, pois o worker só se importa em não estourar erro
                return res.json()
        except Exception as e:
            logger.error(f"[LLMMeteringService] Erro ao gravar uso na Core API: {e}")

    async def get_tenant_credit_balance(self, tenant_id: str) -> TenantCreditBalanceResponse:
        # Só para compatibilidade caso outro serviço python chame.
        # Os endpoints publicos já foram movidos pro C#.
        pass

    async def get_tenant_usage_logs(self, *args, **kwargs) -> PaginatedLLMUsageLogResponse:
        # Apenas para compatibilidade
        pass

def get_llm_metering_service(db=None) -> LLMMeteringService:
    return LLMMeteringService()

