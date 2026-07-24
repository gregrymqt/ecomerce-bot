import json
import logging
from typing import Dict, Any, Union

import pika

from app.features.plans.services.plan_notification_service import PlanNotificationService
from app.features.webhook_mercadopago.schemas import (
    BaseNotificationHandler,
    MercadoPagoNotificationPayload,
    WebhookEventPayload,
)

logger = logging.getLogger(__name__)


# ==============================================================================
# Handlers de Notificação Exemplo
# ==============================================================================
class PaymentApprovedService(BaseNotificationHandler):
    def handle(self, payload: Union[MercadoPagoNotificationPayload, Dict[str, Any]]) -> None:
        if isinstance(payload, dict):
            notification = MercadoPagoNotificationPayload.model_validate(payload)
        else:
            notification = payload

        payment_id = notification.effective_resource_id
        logger.info(f"💳 [PaymentApproved] Processando pagamento #{payment_id}...")


# ==============================================================================
# Mapeador / Dispatcher dos Eventos
# ==============================================================================
class NotificationDispatcher:
    """
    Mapeia o 'tipo' ou 'ação' de evento vindo do payload do webhook 
    para a classe de serviço correspondente.
    """
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

        # Handlers de Planos / Assinaturas do Mercado Pago
        self.register("subscription_preapproval_plan.created", plan_service)
        self.register("subscription_preapproval_plan.updated", plan_service)
        self.register("plan.created", plan_service)
        self.register("plan.updated", plan_service)

    def dispatch(self, event_type: str, payload: Union[MercadoPagoNotificationPayload, Dict[str, Any]]):
        handler = self._handlers.get(event_type)
        if not handler:
            logger.warning(f"⚠️ [Dispatcher] Nenhum handler registrado para o evento: '{event_type}'")
            return

        handler.handle(payload)


# ==============================================================================
# Worker do RabbitMQ
# ==============================================================================
class WebhookWorker:
    def __init__(self, amqp_url: str, queue_name: str):
        self.amqp_url = amqp_url
        self.queue_name = queue_name
        self.dispatcher = NotificationDispatcher()

    def start(self):
        params = pika.URLParameters(self.amqp_url)
        connection = pika.BlockingConnection(params)
        channel = connection.channel()

        channel.queue_declare(queue=self.queue_name, durable=True)
        channel.basic_qos(prefetch_count=1)

        def callback(ch, method, properties, body):
            try:
                raw_json = json.loads(body.decode("utf-8"))

                # Extrai se veio em formato WebhookEventPayload ou direto como payload MP
                if "payload" in raw_json and isinstance(raw_json["payload"], dict):
                    notification = MercadoPagoNotificationPayload.model_validate(raw_json["payload"])
                else:
                    notification = MercadoPagoNotificationPayload.model_validate(raw_json)

                event_type = notification.effective_action

                logger.info(f"📩 [Worker] Mensagem recebida da fila. Evento: '{event_type}'")

                if event_type:
                    self.dispatcher.dispatch(event_type, notification)
                    ch.basic_ack(delivery_tag=method.delivery_tag)
                    logger.info("✅ [Worker] ACK enviado para a fila.")
                else:
                    logger.error("❌ [Worker] Evento não identificado no payload. Rejeitando mensagem.")
                    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

            except Exception as e:
                logger.error(f"💥 [Worker] Erro ao processar mensagem: {e}")
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

        channel.basic_consume(queue=self.queue_name, on_message_callback=callback)

        logger.info(f"🚀 WebhookWorker escutando a fila '{self.queue_name}'. Pressione CTRL+C para sair.")
        try:
            channel.start_consuming()
        except KeyboardInterrupt:
            channel.stop_consuming()
            connection.close()
            logger.info("WebhookWorker finalizado.")


if __name__ == "__main__":
    AMQP_URL = "amqp://guest:guest@localhost:5672/"
    QUEUE_NAME = "mercadopago_webhooks"

    worker = WebhookWorker(amqp_url=AMQP_URL, queue_name=QUEUE_NAME)
    worker.start()
