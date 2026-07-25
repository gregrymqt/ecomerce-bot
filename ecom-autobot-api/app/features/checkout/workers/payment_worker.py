import json
import logging
import aio_pika

from app.core.config.rabbitmq import get_rabbitmq_connection
from app.features.mercadopago.schemas import WebhookEventPayload
from app.features.checkout.services.checkout_notification_service import CheckoutNotificationService

logger = logging.getLogger(__name__)

class PaymentWorker:
    """
    Worker consumidor dedicado a processar eventos de compras pontuais (Checkout Transparente/PIX).
    Escuta a fila 'payments' roteada pelo WebhookDispatcherWorker.
    """
    
    def __init__(self):
        # Instancia o serviço que fará o Zero Trust (busca na API do MP e atualiza o DB/Cache)
        self.notification_service = CheckoutNotificationService()

    async def start_consuming(self, queue_name: str = "payments", channel: aio_pika.abc.AbstractChannel = None):
        try:
            if channel is None:
                connection = await get_rabbitmq_connection()
                channel = await connection.channel()

            # QOS 10: Otimiza o I/O para chamadas externas (API MP) e PostgreSQL em pequenos lotes
            await channel.set_qos(prefetch_count=10)
            
            queue = await channel.get_queue(queue_name)
            logger.info(f"💰 [PaymentWorker] Aguardando eventos financeiros na fila '{queue_name}'...")

            async with queue.iterator() as queue_iter:
                async for message in queue_iter:
                    # requeue=False: falhas enviam a mensagem direto para a Dead Letter Queue (dlq_mercado_pago)
                    async with message.process(requeue=False, ignore_processed=True):
                        try:
                            # 1. Decodifica o evento roteado
                            raw_json = json.loads(message.body.decode("utf-8"))
                            event_payload = WebhookEventPayload.model_validate(raw_json)
                            notification = event_payload.payload

                            logger.info(
                                f"💳 [PaymentWorker] Iniciando processamento | Ação: '{notification.effective_action}' | "
                                f"Order ID: '{notification.effective_resource_id}'"
                            )

                            # 2. Aciona o fluxo de notificação do CheckoutService
                            await self.notification_service.handle(notification)
                            
                            logger.info(f"✅ [PaymentWorker] Order '{notification.effective_resource_id}' sincronizada com sucesso.")

                        except Exception as process_err:
                            logger.error(f"❌ [PaymentWorker] Falha grave ao processar pagamento: {process_err}")
                            # Lança o erro para o RabbitMQ direcionar para a DLX
                            raise 

        except Exception as e:
            logger.error(f"Erro assíncrono na conexão/consumo do RabbitMQ no PaymentWorker: {e}")