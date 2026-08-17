import logging
from typing import Any, Dict, Optional
import aio_pika

from app.core.config.rabbitmq import get_rabbitmq_connection
from app.core.config.redis_db import redis_cache
from app.core.config.settings import settings
from app.features.mercadopago.domain import (
    MercadoPagoSignatureError,
    MercadoPagoWebhookStatus,
    verify_mercadopago_signature,
)
from app.features.mercadopago.repositories.mercadopago_repository import mercadopago_repository
from app.features.mercadopago.schemas.webhook_schemas import (
    MercadoPagoNotificationPayload,
    WebhookEventPayload,
)

logger = logging.getLogger(__name__)


class MercadoPagoWebhookService:
    """
    Serviço de aplicação para validação criptográfica (HMAC-SHA256), verificação de idempotência,
    gravação de auditoria e publicação na fila RabbitMQ 'webhook'.
    """

    def __init__(self) -> None:
        self.webhook_secret = getattr(settings, "MERCADOPAGO_WEBHOOK_SECRET", None)

    def verify_signature(
        self,
        x_signature: Optional[str],
        x_request_id: Optional[str],
        resource_id: str,
    ) -> bool:
        """Valida a assinatura HMAC-SHA256 enviada pelo Mercado Pago."""
        if not self.webhook_secret:
            logger.warning("[WebhookService] MERCADOPAGO_WEBHOOK_SECRET não configurado.")
            raise MercadoPagoSignatureError("Segredo de webhook do Mercado Pago não configurado.")

        if not x_signature or not verify_mercadopago_signature(
            x_signature=x_signature or "",
            x_request_id=x_request_id or "",
            data_id=resource_id,
            secret=self.webhook_secret,
        ):
            logger.warning("[WebhookService] Assinatura HMAC de webhook inválida.")
            raise MercadoPagoSignatureError("Assinatura de Webhook inválida ou adulterada.")

        return True

    async def process_webhook(
        self,
        raw_body: Dict[str, Any],
        resource_id_param: Optional[str] = None,
        x_signature: Optional[str] = None,
        x_request_id: Optional[str] = None,
        queue_name: str = "webhook",
    ) -> Dict[str, str]:
        """
        Processa atômica e assincronamente o evento de webhook recebido do Mercado Pago.
        """
        # 1. Parsing do Payload DTO
        notification = MercadoPagoNotificationPayload.model_validate(raw_body)
        notification.raw_payload = raw_body

        resource_id = resource_id_param or notification.effective_resource_id or ""
        event_type = notification.effective_action

        # 2. Validação Criptográfica de Assinatura
        self.verify_signature(
            x_signature=x_signature,
            x_request_id=x_request_id,
            resource_id=resource_id,
        )

        # 3. Verificação de Idempotência Distribuída via Redis (TTL 24 horas)
        idempotency_key = f"webhook:processed:{resource_id}:{event_type}"
        if redis_cache.redis_client:
            is_new = await redis_cache.redis_client.set(idempotency_key, "1", ex=86400, nx=True)
            if not is_new:
                logger.info(f"🔁 [WebhookService] Evento duplicado ignorado (Resource ID: {resource_id} | Evento: {event_type})")
                return {"status": "already_processed"}
        else:
            existing = await redis_cache.get(idempotency_key)
            if existing:
                logger.info(f"🔁 [WebhookService] Evento duplicado ignorado (Resource ID: {resource_id} | Evento: {event_type})")
                return {"status": "already_processed"}
            await redis_cache.set(idempotency_key, "1", expire_seconds=86400)

        # 4. Auditoria de Entrada no PostgreSQL
        try:
            await mercadopago_repository.log_webhook_event(
                event_type=event_type,
                resource_id=resource_id,
                payload=raw_body,
                status=MercadoPagoWebhookStatus.RECEIVED,
                x_request_id=x_request_id,
            )
        except Exception as log_err:
            logger.warning(f"⚠️ [WebhookService] Falha ao registrar log de auditoria: {log_err}")

        # 5. Publicação Rápida na fila de Webhooks (RabbitMQ)
        event_payload = WebhookEventPayload(
            topic=notification.type,
            action=notification.action,
            resource_id=resource_id,
            payload=notification,
            x_request_id=x_request_id,
        )

        try:
            connection = await get_rabbitmq_connection()
            async with connection:
                channel = await connection.channel()
                await channel.default_exchange.publish(
                    aio_pika.Message(
                        body=event_payload.model_dump_json().encode("utf-8"),
                        content_type="application/json",
                        delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                    ),
                    routing_key=queue_name,
                )
                logger.info(f"✅ [WebhookService] Notificação enfileirada com sucesso na fila '{queue_name}' | Evento: {event_type}")
        except Exception as err:
            logger.error(f"💥 [WebhookService] Falha ao publicar evento no RabbitMQ: {err}", exc_info=True)
            return {"status": "error_queuing"}

        return {"status": "received"}


mercadopago_webhook_service = MercadoPagoWebhookService()
