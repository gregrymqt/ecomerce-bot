import logging
from typing import Optional
from fastapi import HTTPException, status
import httpx

from app.features.mercadopago.infrastructure.client import MercadoPagoClient
from app.features.plans.schemas import (
    CreatePlanRequest,
    PlanResponse,
    PlanSearchResponse,
    SearchPlansQueryParams,
    UpdatePlanRequest,
)

logger = logging.getLogger(__name__)


class PlansClient(MercadoPagoClient):
    """
    Cliente assíncrono desacoplado para a API de Planos de Assinatura do Mercado Pago (/preapproval_plan).
    Extende o `MercadoPagoClient` base.
    """

    async def create_plan(self, request: CreatePlanRequest) -> PlanResponse:
        """
        Cria um plano de assinatura no Mercado Pago.
        POST /preapproval_plan
        """
        url = "/preapproval_plan"
        payload = request.model_dump(exclude_none=True)

        logger.info(f"[PlansClient] Solicitando criação de plano: '{request.reason}'")
        try:
            return await self.post(
                path=url,
                json_data=payload,
                response_model=PlanResponse,
            )
        except httpx.HTTPStatusError as err:
            logger.error(
                f"[PlansClient] Erro HTTP {err.response.status_code} ao criar plano no Mercado Pago: {err.response.text}"
            )
            raise HTTPException(
                status_code=err.response.status_code,
                detail=f"Erro ao criar plano no Mercado Pago: {err.response.text}",
            ) from err

    async def search_plans(
        self, query_params: Optional[SearchPlansQueryParams] = None
    ) -> PlanSearchResponse:
        """
        Busca e filtra planos no Mercado Pago com paginação.
        GET /preapproval_plan/search
        """
        url = "/preapproval_plan/search"
        params = query_params.model_dump(exclude_none=True) if query_params else None

        logger.info(f"[PlansClient] Buscando planos com filtros: {params}")
        try:
            return await self.get(
                path=url,
                params=params,
                response_model=PlanSearchResponse,
            )
        except httpx.HTTPStatusError as err:
            logger.error(
                f"[PlansClient] Erro HTTP {err.response.status_code} ao consultar planos no Mercado Pago: {err.response.text}"
            )
            raise HTTPException(
                status_code=err.response.status_code,
                detail=f"Erro ao buscar planos no Mercado Pago: {err.response.text}",
            ) from err

    async def get_plan_by_id(self, plan_id: str) -> PlanResponse:
        """
        Obtém os detalhes de um plano pelo ID.
        GET /preapproval_plan/{id}
        """
        url = f"/preapproval_plan/{plan_id}"

        logger.info(f"[PlansClient] Obtendo plano pelo ID: '{plan_id}'")
        try:
            return await self.get(
                path=url,
                response_model=PlanResponse,
            )
        except httpx.HTTPStatusError as err:
            if err.response.status_code == status.HTTP_404_NOT_FOUND:
                logger.warning(f"[PlansClient] Plano '{plan_id}' não encontrado no Mercado Pago.")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Plano com ID '{plan_id}' não foi encontrado no Mercado Pago.",
                ) from err
            logger.error(
                f"[PlansClient] Erro HTTP {err.response.status_code} ao buscar plano '{plan_id}': {err.response.text}"
            )
            raise HTTPException(
                status_code=err.response.status_code,
                detail=f"Erro ao buscar plano '{plan_id}' no Mercado Pago: {err.response.text}",
            ) from err

    async def update_plan(self, plan_id: str, request: UpdatePlanRequest) -> PlanResponse:
        """
        Atualiza as configurações de um plano de assinatura existente.
        PUT /preapproval_plan/{id}
        """
        url = f"/preapproval_plan/{plan_id}"
        payload = request.model_dump(exclude_none=True)

        logger.info(f"[PlansClient] Solicitando atualização do plano ID: '{plan_id}'")
        try:
            return await self.put(
                path=url,
                json_data=payload,
                response_model=PlanResponse,
            )
        except httpx.HTTPStatusError as err:
            logger.error(
                f"[PlansClient] Erro HTTP {err.response.status_code} ao atualizar plano '{plan_id}': {err.response.text}"
            )
            raise HTTPException(
                status_code=err.response.status_code,
                detail=f"Erro ao atualizar plano '{plan_id}' no Mercado Pago: {err.response.text}",
            ) from err
