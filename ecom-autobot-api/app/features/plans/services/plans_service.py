import logging
import uuid
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.plans.domain import PlanModel, PlanNotFoundError
from app.features.plans.repositories.plans_repository import PlansRepository
from app.features.plans.schemas import (
    CreatePlanRequest,
    PagingDTO,
    PlanResponse,
    PlanSearchResponse,
    SearchPlansQueryParams,
    UpdatePlanRequest,
)

logger = logging.getLogger(__name__)


class PlansService:
    """
    Serviço de aplicação responsável pelo gerenciamento de planos de assinatura
    operando 100% de forma local via PostgreSQL e Redis.
    """

    def __init__(
        self,
        repository: Optional[PlansRepository] = None,
        session: Optional[AsyncSession] = None,
    ) -> None:
        self.repository = repository or PlansRepository(session=session)

    @staticmethod
    def _model_to_response(model: PlanModel) -> PlanResponse:
        return PlanResponse(
            id=model.id,
            external_id=model.external_id or model.id,
            reason=model.reason,
            status=model.status,
            auto_recurring=model.auto_recurring or {},
            back_url=model.back_url,
            collector_id=model.collector_id,
            application_id=model.application_id,
            date_created=model.created_at.isoformat() if model.created_at else None,
            last_modified=model.updated_at.isoformat() if model.updated_at else None,
        )

    async def create_plan(self, payload: CreatePlanRequest) -> PlanResponse:
        logger.info(f"[PlansService] Criando novo plano local: '{payload.reason}'")

        plan_id = payload.external_id or f"plan_{uuid.uuid4().hex[:10]}"
        auto_recurring_dict = payload.auto_recurring.model_dump()

        plan_model = PlanModel(
            id=plan_id,
            external_id=payload.external_id or plan_id,
            reason=payload.reason,
            status="active",
            auto_recurring=auto_recurring_dict,
            back_url=payload.back_url,
        )

        saved_plan = await self.repository.save(plan_model)
        logger.info(f"[PlansService] Plano ID '{saved_plan.id}' criado com sucesso na base local.")
        return self._model_to_response(saved_plan)

    async def search_plans(
        self, params: Optional[SearchPlansQueryParams] = None
    ) -> PlanSearchResponse:
        params = params or SearchPlansQueryParams()
        limit = params.limit or 20
        offset = params.offset or 0

        logger.info(f"[PlansService] Consultando planos locais com filtros: {params}")
        local_models = await self.repository.list_plans(limit=limit, offset=offset)

        filtered_models = list(local_models)
        if params.status:
            filtered_models = [p for p in filtered_models if p.status.lower() == params.status.lower()]
        if params.q:
            query_term = params.q.lower()
            filtered_models = [p for p in filtered_models if query_term in p.reason.lower()]

        results = [self._model_to_response(model) for model in filtered_models]
        total = len(results)

        return PlanSearchResponse(
            paging=PagingDTO(offset=offset, limit=limit, total=total),
            results=results,
        )

    async def get_plan_by_id(self, plan_id: str) -> PlanResponse:
        logger.info(f"[PlansService] Obtendo detalhes do plano ID: '{plan_id}'")
        local_plan = await self.repository.get_by_id(plan_id)

        if not local_plan:
            raise PlanNotFoundError(plan_id)

        return self._model_to_response(local_plan)

    async def get_plan_by_external_id(self, external_id: str) -> PlanResponse:
        logger.info(f"[PlansService] Obtendo detalhes do plano pelo external_id: '{external_id}'")
        local_plan = await self.repository.get_by_external_id(external_id)

        if not local_plan:
            return await self.get_plan_by_id(external_id)

        return self._model_to_response(local_plan)

    async def update_plan(
        self, plan_id: str, payload: UpdatePlanRequest
    ) -> PlanResponse:
        logger.info(f"[PlansService] Atualizando plano ID: '{plan_id}'")

        existing = await self.repository.get_by_id(plan_id)
        if not existing:
            raise PlanNotFoundError(plan_id)

        update_fields = {}
        if payload.reason is not None:
            update_fields["reason"] = payload.reason
        if payload.status is not None:
            update_fields["status"] = payload.status
        if payload.back_url is not None:
            update_fields["back_url"] = payload.back_url
        if payload.external_id is not None:
            update_fields["external_id"] = payload.external_id

        if payload.auto_recurring is not None:
            current_auto = dict(existing.auto_recurring or {})
            update_auto = payload.auto_recurring.model_dump(exclude_unset=True)
            current_auto.update(update_auto)
            update_fields["auto_recurring"] = current_auto

        updated_plan = await self.repository.update(plan_id, update_fields)
        if not updated_plan:
            raise PlanNotFoundError(plan_id)

        logger.info(f"[PlansService] Plano ID '{plan_id}' atualizado com sucesso.")
        return self._model_to_response(updated_plan)

    async def list_local_plans(
        self, limit: int = 50, offset: int = 0
    ) -> List[PlanResponse]:
        logger.info(f"[PlansService] Listando planos locais (limit={limit}, offset={offset})")
        local_models = await self.repository.list_plans(limit=limit, offset=offset)
        return [self._model_to_response(model) for model in local_models]


plans_service = PlansService()
