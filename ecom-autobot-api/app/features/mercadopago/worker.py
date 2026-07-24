from app.features.checkout.services.checkout_notification_service import CheckoutNotificationService
import asyncio
import json
import logging
from typing import Dict

from app.core.config.rabbitmq import get_rabbitmq_connection
from app.features.plans.services.plan_notification_service import PlanNotificationService
from app.features.subscriptions.notification_service import SubscriptionNotificationService  

from app.features.mercadopago.schemas import (
    BaseNotificationHandler,
    MercadoPagoNotificationPayload,
)

logger = logging.getLogger(__name__)


class PaymentApprovedService(BaseNotificationHandler):
    async def handle(self, payload: MercadoPagoNotificationPayload) -> None:
        payment_id = payload.effective_resource_id
        logger.info(f"💳 [PaymentApproved] Processando pagamento #{payment_id}...")

class NotificationDispatcher:
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

        # ✅ Handlers de Orders / Checkout Transparente
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


class AsyncWebhookWorker:
    def __init__(self,queue_name: str):
        self.queue_name = queue_name
        self.dispatcher = NotificationDispatcher()

    async def start(self):
        connection = await get_rabbitmq_connection()
        async with connection:
            channel = await connection.channel()
            await channel.set_qos(prefetch_count=1)

            queue = await channel.declare_queue(self.queue_name, durable=True)
            logger.info(f"🚀 AsyncWebhookWorker escutando a fila '{self.queue_name}'...")

            async with queue.iterator() as queue_iter:
                async for message in queue_iter:
                    async with message.process():
                        try:
                            raw_json = json.loads(message.body.decode("utf-8"))

                            if "payload" in raw_json and isinstance(raw_json["payload"], dict):
                                notification = MercadoPagoNotificationPayload.model_validate(raw_json["payload"])
                            else:
                                notification = MercadoPagoNotificationPayload.model_validate(raw_json)

                            event_type = notification.effective_action
                            logger.info(f"📩 [Worker] Mensagem recebida. Evento: '{event_type}'")

                            if event_type:
                                await self.dispatcher.dispatch(event_type, notification)
                                logger.info("✅ [Worker] Processado e ACK confirmado automaticamente.")
                            else:
                                logger.error("❌ [Worker] Evento não identificado no payload.")
                        except Exception as e:
                            logger.error(f"💥 [Worker] Erro ao processar mensagem: {e}", exc_info=True)


if __name__ == "__main__":
    QUEUE_NAME = "mercadopago_webhooks"

    worker = AsyncWebhookWorker(queue_name=QUEUE_NAME)
    asyncio.run(worker.start())