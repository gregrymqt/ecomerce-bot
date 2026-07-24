import logging
from typing import Any, Dict, Optional

from app.features.mercadopago.infrastructure.client import MercadoPagoClient
from app.features.subscriptions.schemas import (
    CreateSubscriptionRequest,
    MercadoPagoPreapprovalItemResponse,
    MercadoPagoPreapprovalResponse,
    MercadoPagoSearchQueryParams,
    MercadoPagoSearchSubscriptionsResponse,
    MercadoPagoUpdatePreapprovalRequest,
)

logger = logging.getLogger(__name__)


class SubscriptionsClient(MercadoPagoClient):
    """
    Cliente HTTP assíncrono especializado para gerenciamento de Assinaturas 
    e Recorrências (/preapproval) na REST API do Mercado Pago.
    """

    async def create_subscription(
        self,
        data: CreateSubscriptionRequest,
    ) -> MercadoPagoPreapprovalResponse:
        logger.info(
            f"[SubscriptionsClient] Disparando criação de assinatura para payer_email: '{data.payer_email}' | Plan ID: '{data.preapproval_plan_id}'"
        )

        payload: Dict[str, Any] = data.model_dump(exclude_none=True, mode="json")

        response = await self.post(
            path="/preapproval",
            json_data=payload,
            response_model=MercadoPagoPreapprovalResponse,
        )

        logger.info(
            f"[SubscriptionsClient] Assinatura criada com sucesso no Mercado Pago! ID: '{response.id}' | Status: '{response.status}'"
        )

        return response

    async def search_subscriptions(
        self,
        params: Optional[MercadoPagoSearchQueryParams] = None,
        **kwargs: Any,
    ) -> MercadoPagoSearchSubscriptionsResponse:
        query_params = params.model_dump(exclude_none=True, mode="json") if params else {}

        logger.info(
            f"[SubscriptionsClient] Buscando assinaturas no Mercado Pago com parâmetros: {query_params}"
        )

        response = await self.get(
            path="/preapproval/search",
            params=query_params,
            response_model=MercadoPagoSearchSubscriptionsResponse,
            **kwargs,
        )

        logger.info(
            f"[SubscriptionsClient] Busca realizada com sucesso! Retornados {len(response.results)} itens de um total de {response.paging.total}."
        )

        return response

    async def get_subscription_by_id(
        self,
        preapproval_id: str,
        **kwargs: Any,
    ) -> MercadoPagoPreapprovalItemResponse:
        logger.info(f"[SubscriptionsClient] Obtendo assinatura no Mercado Pago pelo ID: '{preapproval_id}'")

        response = await self.get(
            path=f"/preapproval/{preapproval_id}",
            response_model=MercadoPagoPreapprovalItemResponse,
            **kwargs,
        )

        logger.info(
            f"[SubscriptionsClient] Assinatura '{preapproval_id}' recuperada com sucesso! Status: '{response.status}'"
        )

        return response

    async def update_subscription(
        self,
        preapproval_id: str,
        data: MercadoPagoUpdatePreapprovalRequest,
        **kwargs: Any,
    ) -> MercadoPagoPreapprovalItemResponse:
        logger.info(f"[SubscriptionsClient] Atualizando assinatura no Mercado Pago ID: '{preapproval_id}'")

        payload: Dict[str, Any] = data.model_dump(exclude_none=True, mode="json")

        response = await self.put(
            path=f"/preapproval/{preapproval_id}",
            json_data=payload,
            response_model=MercadoPagoPreapprovalItemResponse,
            **kwargs,
        )

        logger.info(
            f"[SubscriptionsClient] Assinatura '{preapproval_id}' atualizada com sucesso! Novo status: '{response.status}'"
        )

        return response
