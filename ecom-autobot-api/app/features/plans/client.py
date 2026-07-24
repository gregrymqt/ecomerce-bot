import logging
from typing import Optional
from fastapi import HTTPException
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


class PlansClient:
    """
    Cliente de infraestrutura HTTP/REST desacoplado para a API do Mercado Pago.
    Responsável por realizar chamadas HTTP para os endpoints de Pre-approval Plans.
    """

    def __init__(self, mp_client: Optional[MercadoPagoClient] = None) -> None:
        self.mp_client = mp_client or MercadoPagoClient()

    async def create_plan(self, payload: CreatePlanRequest) -> PlanResponse:
        """
        Cria um plano de assinatura recorrente (preapproval_plan) no Mercado Pago.

        :param payload: DTO com as configurações do plano (CreatePlanRequest).
        :return: Instância do DTO PlanResponse com dados de confirmação da API.
        """
        logger.info(f"[PlansService] Criando plano de assinatura: '{payload.reason}'")
        try:
            plan_response = await self.mp_client.post(
                "/preapproval_plan",
                json_data=payload.model_dump(exclude_none=True),
                response_model=PlanResponse,
            )
            logger.info(
                f"[PlansService] Plano '{payload.reason}' criado com sucesso. ID: {plan_response.id}"
            )
            return plan_response
        except httpx.HTTPStatusError as e:
            logger.error(
                f"[PlansService] Erro HTTP {e.response.status_code} ao criar plano '{payload.reason}': {e.response.text}"
            )
            raise e
        except Exception as e:
            logger.error(
                f"[PlansService] Falha inesperada ao criar plano '{payload.reason}': {str(e)}"
            )
            raise e

    async def search_plans(
        self, params: Optional[SearchPlansQueryParams] = None
    ) -> PlanSearchResponse:
        """
        Busca e filtra planos de assinatura (preapproval_plan/search) no Mercado Pago.

        :param params: DTO opcional de filtros e paginação (SearchPlansQueryParams).
        :return: Instância do DTO PlanSearchResponse contendo os resultados e paginação.
        """
        logger.info(f"[PlansService] Buscando planos de assinatura com parâmetros: {params}")
        try:
            query_dict = params.model_dump(exclude_none=True) if params else None
            return await self.mp_client.get(
                "/preapproval_plan/search",
                params=query_dict,
                response_model=PlanSearchResponse,
            )
        except httpx.HTTPStatusError as e:
            logger.error(
                f"[PlansService] Erro HTTP {e.response.status_code} ao buscar planos: {e.response.text}"
            )
            raise e
        except Exception as e:
            logger.error(
                f"[PlansService] Falha inesperada ao buscar planos: {str(e)}"
            )
            raise e

    async def get_plan_by_id(self, plan_id: str) -> PlanResponse:
        """
        Obtém os detalhes completos de um plano de assinatura no Mercado Pago pelo seu ID.

        :param plan_id: ID do plano de assinatura.
        :return: Instância do DTO PlanResponse.
        """
        if not plan_id or not plan_id.strip():
            raise HTTPException(
                status_code=400,
                detail="O ID do plano é obrigatório para realizar a busca.",
            )

        logger.info(f"[PlansService] Buscando plano de assinatura por ID: '{plan_id}'")
        try:
            return await self.mp_client.get(
                f"/preapproval_plan/{plan_id.strip()}",
                response_model=PlanResponse,
            )
        except httpx.HTTPStatusError as err:
            if err.response.status_code == 404:
                logger.warning(f"[PlansService] Plano ID '{plan_id}' não foi encontrado no Mercado Pago.")
                raise HTTPException(
                    status_code=404,
                    detail=f"Plano com ID '{plan_id}' não foi encontrado no Mercado Pago.",
                )
            logger.error(
                f"[PlansService] Erro HTTP {err.response.status_code} ao buscar plano '{plan_id}': {err.response.text}"
            )
            raise err
        except HTTPException:
            raise
        except Exception as err:
            logger.error(
                f"[PlansService] Falha inesperada ao buscar plano '{plan_id}': {str(err)}"
            )
            raise err

    async def update_plan(
        self, plan_id: str, payload: UpdatePlanRequest
    ) -> PlanResponse:
        """
        Atualiza as informações ou o status de um plano de assinatura no Mercado Pago.

        :param plan_id: ID do plano a ser atualizado.
        :param payload: DTO UpdatePlanRequest contendo os campos a serem alterados.
        :return: Instância atualizada do DTO PlanResponse.
        """
        if not plan_id or not plan_id.strip():
            raise HTTPException(
                status_code=400,
                detail="O ID do plano é obrigatório para atualização.",
            )

        json_data = payload.model_dump(exclude_none=True)
        if not json_data:
            raise HTTPException(
                status_code=400,
                detail="Informe ao menos um campo válido para atualizar o plano.",
            )

        logger.info(f"[PlansService] Atualizando plano de assinatura ID: '{plan_id}'")
        try:
            return await self.mp_client.put(
                f"/preapproval_plan/{plan_id.strip()}",
                json_data=json_data,
                response_model=PlanResponse,
            )
        except httpx.HTTPStatusError as err:
            if err.response.status_code == 404:
                logger.warning(f"[PlansService] Plano ID '{plan_id}' não foi encontrado para atualização.")
                raise HTTPException(
                    status_code=404,
                    detail=f"Plano com ID '{plan_id}' não foi encontrado no Mercado Pago.",
                )
            logger.error(
                f"[PlansService] Erro HTTP {err.response.status_code} ao atualizar plano '{plan_id}': {err.response.text}"
            )
            raise err
        except HTTPException:
            raise
        except Exception as err:
            logger.error(
                f"[PlansService] Falha inesperada ao atualizar plano '{plan_id}': {str(err)}"
            )
            raise err
