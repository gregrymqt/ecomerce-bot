from app.core.security.auth import get_current_tenant_user
import csv
import io
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import get_db
from app.features.auth.schemas import AuthenticatedUser
from app.features.plans.repositories import PlansRepository
from app.features.subscriptions.infrastructure import SubscriptionsClient
from app.features.subscriptions.repositories import SubscriptionsRepository
from app.features.subscriptions.schemas import (
    CreateSubscriptionRequest,
    SearchSubscriptionsQueryParams,
    SubscriptionResponse,
    SubscriptionStatusEnum,
    UpdateSubscriptionRequest,
)
from app.features.subscriptions.services import SubscriptionsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


# --------------------------------------------------------------------
# Injeção de Dependência do Serviço
# --------------------------------------------------------------------

def get_subscriptions_service(db: AsyncSession = Depends(get_db)) -> SubscriptionsService:
    repository = SubscriptionsRepository(session=db)
    plans_repository = PlansRepository(session=db)
    client = SubscriptionsClient()
    return SubscriptionsService(
        repository=repository,
        client=client,
        plans_repository=plans_repository,
    )


# --------------------------------------------------------------------
# Endpoints da REST API
# --------------------------------------------------------------------

@router.post(
    "",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar Assinatura Recorrente",
    description="Cria uma nova assinatura no Mercado Pago vinculada ao Tenant e persiste o registro localmente.",
)
async def create_subscription(
    request: CreateSubscriptionRequest,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
    service: SubscriptionsService = Depends(get_subscriptions_service),
) -> SubscriptionResponse:
    try:
        return await service.create_subscription(tenant_id=x_tenant_id, request=request)
    except Exception as err:
        logger.error(f"[SubscriptionsRouter] Erro ao criar assinatura: {err}", exc_info=True)
        if isinstance(err, HTTPException):
            raise err
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha ao processar assinatura no Mercado Pago: {str(err)}",
        )


@router.get(
    "",
    summary="Buscar / Listar Assinaturas",
    description="Retorna a lista paginada e filtrada de assinaturas cadastradas para o Tenant.",
)
async def search_subscriptions(
    page: int = Query(default=1, ge=1, description="Número da página"),
    limit: int = Query(default=10, ge=1, le=100, description="Itens por página"),
    status_param: Optional[SubscriptionStatusEnum] = Query(None, alias="status", description="Filtrar por status"),
    payer_email: Optional[str] = Query(None, description="Filtrar por e-mail do pagador"),
    preapproval_plan_id: Optional[str] = Query(None, description="Filtrar por ID do plano"),
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
    service: SubscriptionsService = Depends(get_subscriptions_service),
):
    params = SearchSubscriptionsQueryParams(
        page=page,
        limit=limit,
        status=status_param,
        payer_email=payer_email,
        preapproval_plan_id=preapproval_plan_id,
    )

    results, total = await service.search_subscriptions(tenant_id=x_tenant_id, params=params)

    return {
        "paging": {
            "page": page,
            "limit": limit,
            "total": total,
        },
        "results": results,
    }


@router.get(
    "/export",
    summary="Exportar Assinaturas (CSV)",
    description="Gera um arquivo CSV paginado contendo todas as assinaturas do Tenant para relatório.",
)
async def export_subscriptions(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
    service: SubscriptionsService = Depends(get_subscriptions_service),
):
    # Busca até 1000 registros para exportação
    params = SearchSubscriptionsQueryParams(page=1, limit=1000)
    results, _ = await service.search_subscriptions(tenant_id=x_tenant_id, params=params)

    output = io.StringIO()
    writer = csv.writer(output)

    # Escreve o cabeçalho
    writer.writerow([
        "ID Interno", "Tenant ID", "Plan ID", "Preapproval ID (MP)",
        "E-mail Pagador", "Status", "Motivo", "Próximo Pagamento", "Criado Em"
    ])

    # Escreve os dados
    for sub in results:
        writer.writerow([
            sub.id,
            sub.tenant_id,
            sub.plan_id or "",
            sub.preapproval_id,
            sub.payer_email,
            sub.status.value if hasattr(sub.status, "value") else str(sub.status),
            sub.reason or "",
            sub.next_payment_date.isoformat() if sub.next_payment_date else "",
            sub.created_at.isoformat() if sub.created_at else "",
        ])

    output.seek(0)

    filename = f"subscriptions_{x_tenant_id}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get(
    "/{subscription_id}",
    response_model=SubscriptionResponse,
    summary="Obter Assinatura por ID",
    description="Retorna os detalhes de uma assinatura específica do Tenant. Suporta sincronização em tempo real com o MP.",
)
async def get_subscription_by_id(
    subscription_id: str,
    sync_with_mp: bool = Query(default=False, description="Sincronizar dados em tempo real com a API do Mercado Pago"),
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
    service: SubscriptionsService = Depends(get_subscriptions_service),
) -> SubscriptionResponse:
    return await service.get_subscription_by_id(
        tenant_id=x_tenant_id,
        subscription_id=subscription_id,
        sync_with_mp=sync_with_mp,
    )


@router.put(
    "/{subscription_id}",
    response_model=SubscriptionResponse,
    summary="Atualizar Assinatura",
    description="Atualiza valores, status ou forma de pagamento da assinatura no Mercado Pago e reflete localmente.",
)
async def update_subscription(
    subscription_id: str,
    request: UpdateSubscriptionRequest,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
    service: SubscriptionsService = Depends(get_subscriptions_service),
) -> SubscriptionResponse:
    return await service.update_subscription(
        tenant_id=x_tenant_id,
        subscription_id=subscription_id,
        request=request,
    )


@router.delete(
    "/{subscription_id}",
    response_model=SubscriptionResponse,
    summary="Cancelar Assinatura",
    description="Cancela uma assinatura recorrente alterando seu status para 'cancelled' no Mercado Pago e no banco local.",
)
async def cancel_subscription(
    subscription_id: str,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
    service: SubscriptionsService = Depends(get_subscriptions_service),
) -> SubscriptionResponse:
    return await service.cancel_subscription(
        tenant_id=x_tenant_id,
        subscription_id=subscription_id,
    )