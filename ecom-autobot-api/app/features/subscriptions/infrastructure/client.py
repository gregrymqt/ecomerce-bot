import logging
from typing import Any, Optional

from fastapi import HTTPException, status

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
    [DEPRECATED / DESATIVADO]
    Cliente de assinaturas recorrentes (/preapproval).
    O sistema foi migrado para o modelo de Carteira Pré-Paga (/v1/payments).
    """

    async def create_subscription(
        self,
        data: CreateSubscriptionRequest,
    ) -> MercadoPagoPreapprovalResponse:
        logger.warning("[SubscriptionsClient] Tentativa de criação de assinatura recorrente em módulo desativado.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O sistema de assinaturas recorrentes (/preapproval) foi desativado. Utilize a recarga de carteira pré-paga.",
        )

    async def search_subscriptions(
        self,
        params: Optional[MercadoPagoSearchQueryParams] = None,
        **kwargs: Any,
    ) -> MercadoPagoSearchSubscriptionsResponse:
        logger.warning("[SubscriptionsClient] Consulta de assinaturas recorrentes em módulo desativado.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O sistema de assinaturas recorrentes foi desativado.",
        )

    async def get_subscription_by_id(
        self,
        preapproval_id: str,
        **kwargs: Any,
    ) -> MercadoPagoPreapprovalItemResponse:
        logger.warning(f"[SubscriptionsClient] Busca por assinatura '{preapproval_id}' em módulo desativado.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O sistema de assinaturas recorrentes foi desativado.",
        )

    async def update_subscription(
        self,
        preapproval_id: str,
        data: MercadoPagoUpdatePreapprovalRequest,
        **kwargs: Any,
    ) -> MercadoPagoPreapprovalItemResponse:
        logger.warning(f"[SubscriptionsClient] Atualização de assinatura '{preapproval_id}' em módulo desativado.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O sistema de assinaturas recorrentes foi desativado.",
        )
