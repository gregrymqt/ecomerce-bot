import logging
from typing import Dict

from app.features.checkout.services.checkout_notification_service import CheckoutNotificationService
from app.features.mercadopago.schemas import (
    BaseNotificationHandler,
    MercadoPagoNotificationPayload,
)
from app.features.plans.services.plan_notification_service import PlanNotificationService
from app.features.subscriptions.notification_service import SubscriptionNotificationService

logger = logging.getLogger(__name__)


class PaymentApprovedService(BaseNotificationHandler):
    async def handle(self, payload: MercadoPagoNotificationPayload) -> None:
        payment_id = payload.effective_resource_id
        logger.info(f"💳 [PaymentApproved] Processando pagamento #{payment_id}...")


class NotificationDispatcher:
    """
    Dispatcher central para rotear notificações de Webhook do Mercado Pago
    para os seus respectivos handlers de serviços (Planos, Assinaturas, Checkout Orders).
    """

    def __init__(self):
        self._handlers: Dict[str, BaseNotificationHandler] = {}
        self._register_default_handlers()

    def register(self, event_type: str, handler: BaseNotificationHandler):
        self._handlers[event_type] = handler

    def _register_default_handlers(self):
        plan_service = PlanNotificationService()
        subscription_service = SubscriptionNotificationService()
        checkout_service = CheckoutNotificationService()

        # Handlers de Planos
        self.register("subscription_preapproval_plan.created", plan_service)
        self.register("subscription_preapproval_plan.updated", plan_service)
        self.register("plan.created", plan_service)
        self.register("plan.updated", plan_service)

        # Handlers de Assinaturas (subscription_preapproval)
        self.register("subscription_preapproval", subscription_service)
        self.register("subscription_preapproval.created", subscription_service)
        self.register("subscription_preapproval.updated", subscription_service)

        # Handlers de Orders / Checkout Transparente
        self.register("order", checkout_service)
        self.register("order.created", checkout_service)
        self.register("order.updated", checkout_service)
        self.register("order.processed", checkout_service)
        self.register("order.action_required", checkout_service)

    async def dispatch(self, event_type: str, payload: MercadoPagoNotificationPayload) -> None:
        handler = self._handlers.get(event_type)
        if handler:
            await handler.handle(payload)
        else:
            logger.warning(f"⚠️ [Dispatcher] Nenhum handler registrado para o evento '{event_type}'.")
