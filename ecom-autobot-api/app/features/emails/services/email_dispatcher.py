import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import aio_pika

from app.core.config.rabbitmq import get_rabbitmq_connection

logger = logging.getLogger(__name__)


class EmailDispatcherService:
    """
    Serviço produtor assíncrono (DDD Application Service) para publicação de eventos
    de e-mails transacionais na fila RabbitMQ 'email_notifications'.
    Trata erros de forma defensiva para não afetar o fluxo principal do banco/negócio.
    """

    def __init__(self, queue_name: str = "email_notifications") -> None:
        self.queue_name = queue_name

    async def publish_email_event(
        self,
        event_name: str,
        recipient_email: str,
        recipient_name: Optional[str] = None,
        tenant_id: Optional[str] = "default",
        data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Publica um evento de e-mail transacional na fila 'email_notifications'.
        Retorna True em caso de sucesso ou False em caso de falha tratada sem exceção.
        """
        if not recipient_email:
            logger.warning(f"[EmailDispatcher] Falha ao disparar '{event_name}': e-mail de destino não fornecido.")
            return False

        payload = {
            "event": event_name,
            "recipient_email": recipient_email,
            "recipient_name": recipient_name or recipient_email.split("@")[0].capitalize(),
            "tenant_id": tenant_id or "default",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data or {},
        }

        try:
            connection = await get_rabbitmq_connection()
            async with connection:
                channel = await connection.channel()
                message_body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                
                await channel.default_exchange.publish(
                    aio_pika.Message(
                        body=message_body,
                        content_type="application/json",
                        delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                    ),
                    routing_key=self.queue_name,
                )
                logger.info(
                    f"📧 [EmailDispatcher] Evento '{event_name}' publicado na fila '{self.queue_name}' para '{recipient_email}' (Tenant: '{tenant_id}')."
                )
                return True

        except Exception as err:
            logger.warning(
                f"⚠️ [EmailDispatcher] Erro ao enfileirar e-mail '{event_name}' para '{recipient_email}': {err}. O fluxo do negócio prosseguirá normalmente."
            )
            return False


email_dispatcher = EmailDispatcherService()
