from datetime import datetime
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Header, Query, status

from app.core.security.auth import get_current_tenant_user
from app.core.shared.logger import get_logger
from app.features.ai_enrichment.schemas.metering_schema import (
    TenantCreditBalanceResponse,
)
from app.features.ai_enrichment.services.metering_service import (
    LLMMeteringService,
    get_llm_metering_service,
)
from app.features.auth.schemas import AuthenticatedUser

logger = get_logger("MeteringRouter")

router = APIRouter(prefix="/metering", tags=["LLM / Metering"])


@router.get("/balance", response_model=TenantCreditBalanceResponse, status_code=status.HTTP_200_OK)
async def get_tenant_balance(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
    metering_service: LLMMeteringService = Depends(get_llm_metering_service),
) -> TenantCreditBalanceResponse:
    """
    Retorna o saldo atual de créditos gerenciados, total de tokens e custos do mês para o tenant autenticado.
    """
    logger.info(f"[MeteringRouter] Consulta de saldo para tenant '{x_tenant_id}' por usuário '{current_user.email}'")
    return await metering_service.get_tenant_credit_balance(tenant_id=x_tenant_id)


@router.get("/usage", status_code=status.HTTP_200_OK)
async def get_tenant_usage_logs(
    page: int = Query(default=1, ge=1, description="Número da página (inicia em 1)"),
    limit: int = Query(default=20, ge=1, le=100, description="Quantidade de registros por página"),
    start_date: Optional[datetime] = Query(default=None, description="Filtro inicial por data de criação"),
    end_date: Optional[datetime] = Query(default=None, description="Filtro final por data de criação"),
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
    metering_service: LLMMeteringService = Depends(get_llm_metering_service),
) -> Dict[str, Any]:
    """
    Retorna o extrato paginado de logs de consumo de tokens do tenant autenticado.
    """
    logger.info(f"[MeteringRouter] Consulta de extrato de uso para tenant '{x_tenant_id}' (página {page}, limite {limit})")
    return await metering_service.get_tenant_usage_logs(
        tenant_id=x_tenant_id,
        page=page,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
    )
