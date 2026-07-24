import logging
from typing import Any, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.plans.client import PlansClient
from app.features.plans.models import PlanModel
from app.features.plans.repository import PlansRepository
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
        """Auxiliar para conversão segura de IDs numéricos vindos da API."""
        if value is None:
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            return None

    # =========================================================================
    # Operações da Feature
    # =========================================================================

    async def create_plan(self, payload: CreatePlanRequest) -> PlanResponse:
        """
        Cria um plano de assinatura recorrente no Mercado Pago e o replica no banco local.
        """
        logger.info(f"[PlansService] Iniciando criação do plano: '{payload.reason}'")

        # 1. Envia requisição HTTP para a API do Mercado Pago
        mp_plan: PlanResponse = await self.client.create_plan(payload)

        # 2. Mapeia e replica a entidade no banco relacional local
        plan_model = PlanModel(
            id=mp_plan.id,
            reason=mp_plan.reason,
            status=mp_plan.status,
            auto_recurring=mp_plan.auto_recurring,
            back_url=mp_plan.back_url,
            collector_id=self._parse_int(mp_plan.collector_id),
            application_id=self._parse_int(mp_plan.application_id),
        )

        # 3. Salva no banco e popula o cache no Redis via Repositório
        await self.repository.save(plan_model)
        logger.info(f"[PlansService] Plano ID '{mp_plan.id}' sincronizado localmente com sucesso.")

        return mp_plan

    async def search_plans(
        self, params: Optional[SearchPlansQueryParams] = None
    ) -> PlanSearchResponse:
        """
        Consulta e filtra planos cadastrados diretamente na API do Mercado Pago.
        """
        logger.info(f"[PlansService] Consultando planos no Mercado Pago com filtros: {params}")
        return await self.client.search_plans(params)

    async def get_plan_by_id(self, plan_id: str) -> PlanResponse:
        """
        Busca os detalhes de um plano. Tenta a API do Mercado Pago primeiro;
        se falhar ou estiver indisponível, recorre à base local/Redis.
        """
        logger.info(f"[PlansService] Obtendo detalhes do plano ID: '{plan_id}'")

        try:
            # Tenta obter dados atualizados diretamente do Mercado Pago
            return await self.client.get_plan_by_id(plan_id)
        except Exception as err:
            logger.warning(
                f"[PlansService] Falha ao buscar plano '{plan_id}' na API do Mercado Pago ({err}). "
                f"Recorrendo ao banco local."
            )
            # Fallback para o banco de dados / Redis
            local_plan = await self.repository.get_by_id(plan_id)
            if local_plan:
                return PlanResponse(
                    id=local_plan.id,
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

    async def update_plan(
        self, plan_id: str, payload: UpdatePlanRequest
    ) -> PlanResponse:
        """
        Atualiza ou desativa um plano no Mercado Pago e sincroniza o registro local.
        """
        logger.info(f"[PlansService] Atualizando plano ID: '{plan_id}'")

        # 1. Atualiza na API do Mercado Pago
        updated_mp_plan: PlanResponse = await self.client.update_plan(plan_id, payload)

        # 2. Prepara os campos alterados para atualizar o repositório local
        update_fields = {
            "reason": updated_mp_plan.reason,
            "status": updated_mp_plan.status,
            "back_url": updated_mp_plan.back_url,
            "auto_recurring": updated_mp_plan.auto_recurring,
        }
        
        # Remove valores nulos do dicionário de atualização
        clean_update_fields = {k: v for k, v in update_fields.items() if v is not None}

        # 3. Atualiza localmente e invalida cache no Redis
        await self.repository.update(plan_id, clean_update_fields)
        logger.info(f"[PlansService] Plano ID '{plan_id}' atualizado localmente.")

        return updated_mp_plan

    async def list_local_plans(
        self, limit: int = 50, offset: int = 0
    ) -> List[PlanResponse]:
        """
        Lista os planos mantidos na base relacional local (otimizado com cache Redis).
        """
        logger.info(f"[PlansService] Listando planos locais (limit={limit}, offset={offset})")
        local_models = await self.repository.list_plans(limit=limit, offset=offset)

        return [
            PlanResponse(
                id=model.id,
                reason=model.reason,
                status=model.status,
                auto_recurring=model.auto_recurring,
                back_url=model.back_url,
                collector_id=model.collector_id,
                application_id=model.application_id,
            )
            for model in local_models
        ]