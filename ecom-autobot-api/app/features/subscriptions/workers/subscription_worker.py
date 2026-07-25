import json
import logging
from typing import Optional
import aio_pika

from app.core.config.rabbitmq import get_rabbitmq_connection
from app.features.mercadopago.schemas import WebhookEventPayload
from app.features.subscriptions.services.subscription_notification_service import SubscriptionNotificationService

logger = logging.getLogger(__name__)

class SubscriptionWorker:
    """
    Worker consumidor dedicado a processar eventos de Assinaturas (Subscriptions).
    Escuta a fila 'subscription' populada pelo WebhookDispatcherWorker.
    """

    def __init__(self):
        # Instancia o serviço que já contém toda a lógica de negócio e acesso a DB/API
        self.notification_service = SubscriptionNotificationService()

    async def start_consuming(self, queue_name: str = "subscription", channel: aio_pika.abc.AbstractChannel = None):
        try:
            if channel is None:
                connection = await get_rabbitmq_connection()
                channel = await connection.channel()

            # QOS: 10. Como esse worker faz chamadas HTTP externas (Mercado Pago) 
            # e acessa o PostgreSQL, processar em pequenos lotes otimiza o I/O sem travar.
            await channel.set_qos(prefetch_count=10)
            
            queue = await channel.get_queue(queue_name)

            logger.info(f"🚀 SubscriptionWorker aguardando eventos na fila '{queue_name}'...")

            async with queue.iterator() as queue_iter:
                async for message in queue_iter:
                    # requeue=False garante que, em caso de erro (raise), a mensagem vá direto para a DLQ (dlq_mercado_pago)
                    async with message.process(requeue=False, ignore_processed=True):
                        try:
                            # 1. Decodifica o payload roteado pelo Dispatcher
                            raw_json = json.loads(message.body.decode("utf-8"))
                            
                            # O Dispatcher empacotou a notificação original dentro do WebhookEventPayload
                            event_payload = WebhookEventPayload.model_validate(raw_json)
                            notification = event_payload.payload
                            
                            logger.info(
                                f"📩 [SubscriptionWorker] Iniciando processamento | Evento: '{notification.effective_action}' | "
                                f"Preapproval ID: '{notification.effective_resource_id}'"
                            )

                            # 2. Aciona o Service de Negócio que você já construiu
                            await self.notification_service.handle(notification)

                            logger.info(f"✅ [SubscriptionWorker] Assinatura '{notification.effective_resource_id}' sincronizada com sucesso no banco de dados.")

                        except Exception as process_err:
                            logger.error(f"💥 [SubscriptionWorker] Falha grave ao processar assinatura: {process_err}", exc_info=True)
                            # O raise lança o erro para o Message.process(), enviando a msg para a Dead Letter Exchange
                            raise 

        except Exception as e:
            logger.error(f"Erro assíncrono na conexão/consumo do RabbitMQ no SubscriptionWorker: {e}")