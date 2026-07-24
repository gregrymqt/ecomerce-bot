import asyncio
import json
import logging
import aio_pika

from app.core.config.rabbitmq import get_rabbitmq_connection
from app.features.mercadopago.schemas import MercadoPagoNotificationPayload
from app.features.mercadopago.services import NotificationDispatcher

logger = logging.getLogger(__name__)


class AsyncWebhookWorker:
    """
    Worker assíncrono para consumir notificações de webhooks persistidas
    na fila do RabbitMQ e despachar para os respectivos serviços de negócio.
    """

    def __init__(self, queue_name: str = "mercadopago_webhooks"):
        self.queue_name = queue_name
        self.dispatcher = NotificationDispatcher()

    async def start(self):
        connection = await get_rabbitmq_connection()
        async with connection:
            channel = await connection.channel()
            await channel.set_qos(prefetch_count=1)

            # Declara exchange e vincula a fila para garantir o fluxo de mensagens
            exchange = await channel.declare_exchange("billing_events", aio_pika.ExchangeType.DIRECT, durable=True)
            queue = await channel.declare_queue(self.queue_name, durable=True)
            await queue.bind(exchange, routing_key="payment_updates")

            logger.info(f"🚀 AsyncWebhookWorker escutando a fila '{self.queue_name}' vinculada à exchange 'billing_events'...")

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

