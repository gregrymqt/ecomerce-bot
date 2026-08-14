import logging
from decimal import Decimal
from typing import Optional, TYPE_CHECKING

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.checkout.domain.models import OrderModel
from app.features.checkout.repositories.order_repository import OrderRepository
from app.features.checkout.schemas.service_schemas import (
    CheckoutResultOutput,
    CreateCreditCardCheckoutInput,
    CreatePixCheckoutInput,
)
from app.features.checkout.services.order_service import OrderService
from app.features.checkout.services.payment_service import (
    PaymentService,
    REJECTED_PAYMENT_MESSAGES,
    get_friendly_credit_card_error_message,
)
from app.features.checkout.services.refund_service import RefundService

logger = logging.getLogger(__name__)


def _get_order_client():
    from app.features.checkout.infrastructure.client import MercadoPagoOrderClient
    return MercadoPagoOrderClient()


class CheckoutService:
    """
    Facade de Serviço de Domínio/Aplicação para gestão de Checkout Transparente.
    Delega as operações para os serviços especializados de Pagamento, Pedido e Reembolso,
    garantindo retrocompatibilidade total para chamadas legadas e testes unitários.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self._payment_service = PaymentService(session)
        self._order_service = OrderService(session)
        self._refund_service = RefundService(session)

    @property
    def order_repo(self) -> OrderRepository:
        return self._payment_service.order_repo

    @order_repo.setter
    def order_repo(self, repo: OrderRepository) -> None:
        self._payment_service.order_repo = repo
        self._order_service.order_repo = repo
        self._refund_service.order_repo = repo
        self._refund_service.order_service.order_repo = repo

    async def create_pix_payment(
        self, tenant_id: str, input_data: CreatePixCheckoutInput
    ) -> CheckoutResultOutput:
        return await self._payment_service.create_pix_payment(tenant_id, input_data)

    async def create_credit_card_payment(
        self, tenant_id: str, input_data: CreateCreditCardCheckoutInput
    ) -> CheckoutResultOutput:
        return await self._payment_service.create_credit_card_payment(tenant_id, input_data)

    async def sync_order_status_from_mp(
        self, tenant_id: str, mp_order_id: str
    ) -> Optional[OrderModel]:
        return await self._order_service.sync_order_status_from_mp(tenant_id, mp_order_id)

    async def _fulfill_wallet_recharge_if_needed(self, order: OrderModel) -> None:
        return await self._order_service._fulfill_wallet_recharge_if_needed(order)

    async def cancel_order(self, tenant_id: str, order_id: str) -> bool:
        return await self._refund_service.cancel_order(tenant_id, order_id)

    async def refund_order(
        self, tenant_id: str, order_id: str, amount: Optional[Decimal] = None
    ) -> bool:
        return await self._refund_service.refund_order(tenant_id, order_id, amount)