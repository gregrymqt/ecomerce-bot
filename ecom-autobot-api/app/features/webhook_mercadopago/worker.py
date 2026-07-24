import asyncio
import json
import logging
from typing import Dict, Union

import aio_pika

from app.core.config.settings import settings
from app.features.plans.services.plan_notification_service import PlanNotificationService
from app.features.webhook_mercadopago.schemas import (
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

        # Handlers de Pagamento
        self.register("payment.created", PaymentApprovedService())
        self.register("payment.updated", PaymentApprovedService())

        # Handlers de Planos / Assinaturas
        self.register("subscription_preapproval_plan.created", plan_service)
        self.register("subscription_preapproval_plan.updated", plan_service)
        self.register("plan.created", plan_service)
        self.register("plan.updated", plan_service)

    async def dispatch(self, event_type: str, payload: MercadoPagoNotificationPayload) -> bool:
        handler = self._handlers.get(event_type)
        if not handler:
            logger.warning(f"⚠️ [Dispatcher] Nenhum handler registrado para o evento: '{event_type}'")
            return False

        # Aguarda a execução assíncrona real da regra de negócio
        await handler.handle(payload)
        return True


class AsyncWebhookWorker:
    def __init__(self, amqp_url: str, queue_name: str):
        self.amqp_url = amqp_url
        self.queue_name = queue_name
        self.dispatcher = NotificationDispatcher()

    async def start(self):
        connection = await aio_pika.connect_robust(self.amqp_url)
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
    AMQP_URL = getattr(settings, "RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
    QUEUE_NAME = "mercadopago_webhooks"

    worker = AsyncWebhookWorker(amqp_url=AMQP_URL, queue_name=QUEUE_NAME)
    asyncio.run(worker.start())