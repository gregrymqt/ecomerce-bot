# app/features/mercadopago/workers/webhook_worker.py
import json
import logging
import aio_pika

from app.core.config.rabbitmq import get_rabbitmq_connection
from app.features.mercadopago.schemas import WebhookEventPayload

logger = logging.getLogger(__name__)

class WebhookDispatcherWorker:
    """
    Roteador assíncrono. Consome a fila rápida de 'webhook', identifica
    o tipo de evento e distribui para as filas de negócios pesadas 
    ('payments' ou 'subscription').
    """
    
    # Mapeamento estático baseado no seu NotificationDispatcher original
    SUBSCRIPTION_EVENTS = {
        "subscription_preapproval_plan.created",
        "subscription_preapproval_plan.updated",
        "plan.created",
        "plan.updated",
        "subscription_preapproval",
        "subscription_preapproval.created",
        "subscription_preapproval.updated"
    }

    PAYMENT_EVENTS = {
        "order",
        "order.created",
        "order.updated",
        "order.processed",
        "order.action_required",
        "payment",
        "payment.created",
        "payment.updated"
    }

    async def start_consuming(self, queue_name: str = "webhook", channel: aio_pika.abc.AbstractChannel | None = None) -> None:
        try:
            if channel is None:
                connection = await get_rabbitmq_connection()
                channel = await connection.channel()
                
            # QOS alto porque rotear mensagens é extremamente rápido e não consome memória
            await channel.set_qos(prefetch_count=50) 
            queue = await channel.get_queue(queue_name)
            
            logger.info(f"🚀 WebhookDispatcherWorker escutando a fila '{queue_name}'...")

            async with queue.iterator() as queue_iter:
                async for message in queue_iter:
                    try:
                        async with message.process(requeue=False, ignore_processed=True):
                            raw_json = json.loads(message.body.decode("utf-8"))
                            event_payload = WebhookEventPayload.model_validate(raw_json)
                            event_type = event_payload.payload.effective_action
                            
                            logger.info(f"📩 [Dispatcher] Analisando Evento: '{event_type}'")

                            target_queue = None
                            if event_type in self.SUBSCRIPTION_EVENTS:
                                target_queue = "subscription"
                            elif event_type in self.PAYMENT_EVENTS:
                                target_queue = "payments"

                            if target_queue:
                                await channel.default_exchange.publish(
                                    aio_pika.Message(
                                        body=message.body,
                                        content_type="application/json",
                                        delivery_mode=aio_pika.DeliveryMode.PERSISTENT
                                    ),
                                    routing_key=target_queue
                                )
                                logger.info(f"✅ [Dispatcher] Evento roteado para a fila de negócio: '{target_queue}'")
                            else:
                                logger.warning(f"⚠️ [Dispatcher] Evento '{event_type}' não mapeado. Descartando mensagem.")
                    except asyncio.CancelledError:
                        raise
                    except Exception as e:
                        logger.error(f"💥 [Dispatcher] Erro de roteamento no evento: {e}", exc_info=True)
                        try:
                            await message.nack(requeue=False)
                        except Exception:
                            pass

        except asyncio.CancelledError:
            logger.info("🛑 [WebhookDispatcherWorker] Task do worker encerrada graciosamente.")
            raise
        except Exception as e:
            logger.error(f"Erro assíncrono na conexão/consumo do RabbitMQ no Dispatcher: {e}")


webhook_dispatcher_worker = WebhookDispatcherWorker()


if __name__ == "__main__":
    import asyncio

    async def main():
        worker = WebhookDispatcherWorker()
        await worker.start_consuming()

    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("🛑 Worker interrompido manualmente.")