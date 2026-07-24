import logging
from typing import Any, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.plans.domain.models import PlanModel
from app.features.plans.infrastructure.client import PlansClient
from app.features.plans.repositories.plans_repository import PlansRepository
from app.features.plans.schemas import (
    CreatePlanRequest,
    PlanResponse,
    PlanSearchResponse,
    SearchPlansQueryParams,
    UpdatePlanRequest,
)

logger = logging.getLogger(__name__)


class PlansService:
    """
    Serviço de domínio responsável por orquestrar o fluxo de dados entre:
    1. A API do Mercado Pago (via PlansClient)
    2. A persistência local e cache Redis (via PlansRepository)
    """

    def __init__(
        self,
        repository: Optional[PlansRepository] = None,
        client: Optional[PlansClient] = None,
        session: Optional[AsyncSession] = None,
    ) -> None:
        self.repository = repository or PlansRepository(session=session)
        self.client = client or PlansClient()

    @staticmethod
    def _parse_int(value: Any) -> Optional[int]:
        if value is None:
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            return None

    async def create_plan(self, payload: CreatePlanRequest) -> PlanResponse:
        logger.info(f"[PlansService] Iniciando criação do plano: '{payload.reason}'")

        mp_plan: PlanResponse = await self.client.create_plan(payload)
        external_id = mp_plan.external_id or payload.external_id or mp_plan.id

        plan_model = PlanModel(
            id=mp_plan.id,
            external_id=external_id,
            reason=mp_plan.reason,
            status=mp_plan.status,
            auto_recurring=mp_plan.auto_recurring,
            back_url=mp_plan.back_url,
            collector_id=self._parse_int(mp_plan.collector_id),
            application_id=self._parse_int(mp_plan.application_id),
        )

        await self.repository.save(plan_model)
        logger.info(f"[PlansService] Plano ID '{mp_plan.id}' (External ID: '{external_id}') sincronizado localmente.")

        mp_plan.external_id = external_id
        return mp_plan

    async def search_plans(
        self, params: Optional[SearchPlansQueryParams] = None
    ) -> PlanSearchResponse:
        logger.info(f"[PlansService] Consultando planos no Mercado Pago com filtros: {params}")
        return await self.client.search_plans(params)

    async def get_plan_by_id(self, plan_id: str) -> PlanResponse:
        logger.info(f"[PlansService] Obtendo detalhes do plano ID: '{plan_id}'")

        try:
            mp_plan = await self.client.get_plan_by_id(plan_id)
            if not mp_plan.external_id:
                mp_plan.external_id = mp_plan.id
            return mp_plan
        except Exception as err:
            logger.warning(
                f"[PlansService] Falha ao buscar plano '{plan_id}' na API do Mercado Pago ({err}). "
                f"Recorrendo ao banco local."
            )
            local_plan = await self.repository.get_by_id(plan_id)
            if local_plan:
                return PlanResponse(
                    id=local_plan.id,
                    external_id=local_plan.external_id or local_plan.id,
                    reason=local_plan.reason,
                    status=local_plan.status,
                    auto_recurring=local_plan.auto_recurring,
                    back_url=local_plan.back_url,
                    collector_id=local_plan.collector_id,
                    application_id=local_plan.application_id,
                )

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Plano com ID '{plan_id}' não foi encontrado.",
            ) from err

    async def get_plan_by_external_id(self, external_id: str) -> PlanResponse:
        logger.info(f"[PlansService] Obtendo detalhes do plano pelo external_id: '{external_id}'")
        local_plan = await self.repository.get_by_external_id(external_id)

        if local_plan:
            return PlanResponse(
                id=local_plan.id,
                external_id=local_plan.external_id or local_plan.id,
                reason=local_plan.reason,
                status=local_plan.status,
                auto_recurring=local_plan.auto_recurring,
                back_url=local_plan.back_url,
                collector_id=local_plan.collector_id,
                application_id=local_plan.application_id,
            )

        return await self.get_plan_by_id(external_id)

    async def update_plan(
        self, plan_id: str, payload: UpdatePlanRequest
    ) -> PlanResponse:
        logger.info(f"[PlansService] Atualizando plano ID: '{plan_id}'")

        updated_mp_plan: PlanResponse = await self.client.update_plan(plan_id, payload)

        update_fields = {
            "external_id": payload.external_id or updated_mp_plan.external_id or updated_mp_plan.id,
            "reason": updated_mp_plan.reason,
            "status": updated_mp_plan.status,
            "back_url": updated_mp_plan.back_url,
            "auto_recurring": updated_mp_plan.auto_recurring,
        }

        clean_update_fields = {k: v for k, v in update_fields.items() if v is not None}

        await self.repository.update(plan_id, clean_update_fields)
        logger.info(f"[PlansService] Plano ID '{plan_id}' atualizado localmente.")

        updated_mp_plan.external_id = clean_update_fields.get("external_id", updated_mp_plan.id)
        return updated_mp_plan

    async def list_local_plans(
        self, limit: int = 50, offset: int = 0
    ) -> List[PlanResponse]:
        logger.info(f"[PlansService] Listando planos locais (limit={limit}, offset={offset})")
        local_models = await self.repository.list_plans(limit=limit, offset=offset)

        return [
            PlanResponse(
                id=model.id,
                external_id=model.external_id or model.id,
                reason=model.reason,
                status=model.status,
                auto_recurring=model.auto_recurring,
                back_url=model.back_url,
                collector_id=model.collector_id,
                application_id=model.application_id,
            )
            for model in local_models
        ]
