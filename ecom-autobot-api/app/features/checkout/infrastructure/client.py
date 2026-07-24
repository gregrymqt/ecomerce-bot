import logging
import uuid
from typing import Optional

from app.features.checkout.schemas import (
    CancelMPOrderResponse,
    CreateMPOrderRequest,
    CreateMPOrderResponse,
    GetMPOrderResponse,
    RefundMPOrderRequest,
    RefundMPOrderResponse,
)
from app.features.mercadopago.client import MercadoPagoClient

logger = logging.getLogger(__name__)


class MercadoPagoOrderClient(MercadoPagoClient):
    """
    Extensão do MercadoPagoClient focada nos endpoints de Orders (/v1/orders).
    """

    async def create_order(
        self,
        order_request: CreateMPOrderRequest,
        idempotency_key: Optional[str] = None,
    ) -> CreateMPOrderResponse:
        """
        Cria uma nova Order no Mercado Pago (Checkout Transparente para PIX, Cartão, Boleto, etc.).
        """
        key = idempotency_key or str(uuid.uuid4())
        headers = {
            "X-Idempotency-Key": key,
        }

        payload = order_request.model_dump(mode="json", exclude_none=True)

        logger.info(
            f"[MercadoPagoOrderClient] Criando order external_ref='{order_request.external_reference}' "
            f"com Idempotency-Key='{key}'"
        )

        response: CreateMPOrderResponse = await self.post(
            path="/v1/orders",
            json_data=payload,
            headers=headers,
            response_model=CreateMPOrderResponse,
        )

        logger.info(
            f"[MercadoPagoOrderClient] Order criada com sucesso! "
            f"MP_Order_ID='{response.id}', Status='{response.status}'"
        )

        return response

    async def get_order_by_id(self, order_id: str) -> GetMPOrderResponse:
        """
        Busca os detalhes completos de uma Order no Mercado Pago pelo ID.
        """
        logger.info(f"[MercadoPagoOrderClient] Consultando order MP_Order_ID='{order_id}'")

        response: GetMPOrderResponse = await self.get(
            path=f"/v1/orders/{order_id}",
            response_model=GetMPOrderResponse,
        )

        logger.info(
            f"[MercadoPagoOrderClient] Order consultada com sucesso! "
            f"MP_Order_ID='{response.id}', Status='{response.status}', StatusDetail='{response.status_detail}'"
        )

        return response

    async def cancel_order(
        self,
        order_id: str,
        idempotency_key: Optional[str] = None,
    ) -> CancelMPOrderResponse:
        """
        Cancela uma Order e suas transações pendentes no Mercado Pago.
        """
        key = idempotency_key or str(uuid.uuid4())
        headers = {
            "X-Idempotency-Key": key,
        }

        logger.info(
            f"[MercadoPagoOrderClient] Solicitando cancelamento da order MP_Order_ID='{order_id}' "
            f"com Idempotency-Key='{key}'"
        )

        response: CancelMPOrderResponse = await self.post(
            path=f"/v1/orders/{order_id}/cancel",
            headers=headers,
            response_model=CancelMPOrderResponse,
        )

        logger.info(
            f"[MercadoPagoOrderClient] Order cancelada com sucesso! "
            f"MP_Order_ID='{response.id}', Status='{response.status}', StatusDetail='{response.status_detail}'"
        )

        return response

    async def refund_order(
        self,
        order_id: str,
        refund_request: Optional[RefundMPOrderRequest] = None,
        idempotency_key: Optional[str] = None,
    ) -> RefundMPOrderResponse:
        """
        Executa o reembolso (estorno) total ou parcial de uma Order no Mercado Pago.
        """
        key = idempotency_key or str(uuid.uuid4())
        headers = {
            "X-Idempotency-Key": key,
        }

        payload = None
        if refund_request and refund_request.transactions:
            payload = refund_request.model_dump(mode="json", exclude_none=True)

        refund_type = "parcial" if payload else "total"
        logger.info(
            f"[MercadoPagoOrderClient] Solicitando reembolso ({refund_type}) da order MP_Order_ID='{order_id}' "
            f"com Idempotency-Key='{key}'"
        )

        response: RefundMPOrderResponse = await self.post(
            path=f"/v1/orders/{order_id}/refund",
            json_data=payload,
            headers=headers,
            response_model=RefundMPOrderResponse,
        )

        logger.info(
            f"[MercadoPagoOrderClient] Reembolso processado com sucesso! "
            f"MP_Order_ID='{response.id}', Status='{response.status}', Detail='{response.status_detail}'"
        )

        return response
