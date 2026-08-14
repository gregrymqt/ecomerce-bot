import logging
from decimal import Decimal
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from app.features.checkout.infrastructure.client import MercadoPagoOrderClient

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.checkout.domain.enums import OrderStatus, OrderStatusDetail
from app.features.checkout.domain.exceptions import (
    OrderCancellationError,
    OrderNotFoundError,
    OrderRefundError,
)
from app.features.checkout.repositories.order_repository import OrderRepository
from app.features.checkout.schemas import (
    RefundMPOrderRequest,
    RefundTransactionInputSchema,
)
from app.features.checkout.services.order_service import OrderService

logger = logging.getLogger(__name__)


def _get_order_client():
    from app.features.checkout.infrastructure.client import MercadoPagoOrderClient
    return MercadoPagoOrderClient()


class RefundService:
    """
    Serviço de Domínio responsável pelo cancelamento e reembolso/estorno de pedidos.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.order_repo = OrderRepository(session)
        self.order_service = OrderService(session)

    async def cancel_order(self, tenant_id: str, order_id: str) -> bool:
        """Cancela uma order pendente localmente e no Mercado Pago."""
        local_order = await self.order_repo.get_by_id(tenant_id, order_id)
        if not local_order or not local_order.mp_order_id:
            raise OrderNotFoundError(order_id)

        try:
            async with _get_order_client() as mp_client:
                await mp_client.cancel_order(order_id=local_order.mp_order_id)
        except Exception as mp_err:
            logger.error(f"[RefundService] Erro ao cancelar pedido MP '{local_order.mp_order_id}': {mp_err}")
            raise OrderCancellationError(f"Não foi possível cancelar o pedido no Mercado Pago: {str(mp_err)}")

        local_order.status = OrderStatus.CANCELED
        local_order.status_detail = OrderStatusDetail.CANCELED
        await self.order_repo.update(local_order)
        await self.session.commit()
        return True

    async def refund_order(
        self, tenant_id: str, order_id: str, amount: Optional[Decimal] = None
    ) -> bool:
        """Executa o estorno/reembolso de um pagamento aprovado."""
        local_order = await self.order_repo.get_by_id(tenant_id, order_id)
        if not local_order or not local_order.mp_order_id:
            raise OrderNotFoundError(order_id)

        refund_req = None
        if amount and local_order.raw_mp_response:
            payments = local_order.raw_mp_response.get("transactions", {}).get("payments", [])
            if payments:
                pay_id = payments[0].get("id")
                refund_req = RefundMPOrderRequest(
                    transactions=[RefundTransactionInputSchema(id=pay_id, amount=f"{amount:.2f}")]
                )

        try:
            async with _get_order_client() as mp_client:
                await mp_client.refund_order(order_id=local_order.mp_order_id, refund_request=refund_req)
        except Exception as mp_err:
            logger.error(f"[RefundService] Erro ao reembolsar pedido MP '{local_order.mp_order_id}': {mp_err}")
            raise OrderRefundError(f"Não foi possível processar o reembolso no Mercado Pago: {str(mp_err)}")

        await self.order_service.sync_order_status_from_mp(tenant_id, local_order.mp_order_id)
        return True
