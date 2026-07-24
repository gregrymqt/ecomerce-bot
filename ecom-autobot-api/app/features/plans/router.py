from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import get_db
from app.core.security.auth import get_current_user_admin
from app.features.auth.schemas import AuthenticatedUser
from app.features.plans.schemas import (
    CreatePlanRequest,
    PlanResponse,
    PlanSearchResponse,
    SearchPlansQueryParams,
    UpdatePlanRequest,
)
from app.features.plans.service import PlansService

router = APIRouter(prefix="/plans", tags=["Plans"])


@router.post(
    "/",
    response_model=PlanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar novo plano de assinatura (Somente Admin)",
    description="Cria um plano de assinatura no Mercado Pago e o sincroniza na base local e no Redis. Exige privilégios de Admin.",
)
async def create_plan(
    payload: CreatePlanRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user_admin),
) -> PlanResponse:
    service = PlansService(session=db)
    return await service.create_plan(payload)


@router.get(
    "/",
    response_model=PlanSearchResponse,
    status_code=status.HTTP_200_OK,
    summary="Buscar e filtrar planos no Mercado Pago (Somente Admin)",
    description="Consulta o catálogo de planos diretamente da API REST do Mercado Pago com paginação e filtros. Exige privilégios de Admin.",
)
async def search_plans(
    status_filter: Optional[str] = Query(None, alias="status", description="Status do plano (ex: active, cancelled)"),
    q: Optional[str] = Query(None, description="Termo de busca na razão social/descrição"),
    sort: Optional[str] = Query(None, description="Campo para ordenação"),
    criteria: Optional[str] = Query(None, description="Critério de ordenação (asc/desc)"),
    offset: int = Query(0, ge=0, description="Deslocamento para paginação"),
    limit: int = Query(20, ge=1, le=100, description="Quantidade máxima de itens"),
    db: AsyncSession = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user_admin),
) -> PlanSearchResponse:
    params = SearchPlansQueryParams(
        status=status_filter,
        q=q,
        sort=sort,
        criteria=criteria,
        offset=offset,
        limit=limit,
    )
    service = PlansService(session=db)
    return await service.search_plans(params)


@router.get(
    "/local",
    response_model=List[PlanResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar planos locais (Cache / Banco) (Somente Admin)",
    description="Retorna os planos sincronizados localmente na base PostgreSQL com aceleração via Redis. Exige privilégios de Admin.",
)
async def list_local_plans(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user_admin),
) -> List[PlanResponse]:
    service = PlansService(session=db)
    return await service.list_local_plans(limit=limit, offset=offset)


@router.get(
    "/{plan_id}",
    response_model=PlanResponse,
    status_code=status.HTTP_200_OK,
    summary="Obter detalhes de um plano (Somente Admin)",
    description="Busca os detalhes de um plano pelo ID na API do Mercado Pago ou com fallback local. Exige privilégios de Admin.",
)
async def get_plan_by_id(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user_admin),
) -> PlanResponse:
    service = PlansService(session=db)
    return await service.get_plan_by_id(plan_id)


@router.put(
    "/{plan_id}",
    response_model=PlanResponse,
    status_code=status.HTTP_200_OK,
    summary="Atualizar ou desativar plano (Somente Admin)",
    description="Atualiza valores, nome ou status de um plano de assinatura no Mercado Pago e limpa o cache local. Exige privilégios de Admin.",
)
async def update_plan(
    plan_id: str,
    payload: UpdatePlanRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthenticatedUser = Depends(get_current_user_admin),
) -> PlanResponse:
    service = PlansService(session=db)
    return await service.update_plan(plan_id, payload)