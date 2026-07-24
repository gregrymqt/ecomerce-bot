import logging
from typing import Any, Dict, Optional

import aio_pika
from fastapi import APIRouter, Header, HTTPException, Query, Request, status

from app.core.config.rabbitmq import get_rabbitmq_connection
from app.core.config.redis_db import redis_cache
from app.core.config.settings import settings
from app.features.mercadopago.domain import verify_mercadopago_signature
from app.features.mercadopago.schemas import (
    MercadoPagoNotificationPayload,
    WebhookEventPayload,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post(
    "/mercadopago",
    status_code=status.HTTP_200_OK,
    summary="Receptor de Webhooks do Mercado Pago (Otimizado)",
    description="Recebe notificações de pagamentos e assinaturas com validação estrita HMAC, trava de idempotência no Redis e publicação segura no RabbitMQ.",
)
async def mercadopago_webhook(
    request: Request,
    data_id: Optional[str] = Query(None, alias="data.id"),
    id_param: Optional[str] = Query(None, alias="id"),
    x_signature: Optional[str] = Header(None, alias="x-signature"),
    x_request_id: Optional[str] = Header(None, alias="x-request-id"),
) -> Dict[str, str]:
    try:
        raw_body: Dict[str, Any] = await request.json()
    except Exception:
        raw_body = {}

    notification = MercadoPagoNotificationPayload.model_validate(raw_body)
    notification.raw_payload = raw_body

    resource_id = data_id or id_param or notification.effective_resource_id or ""
    webhook_secret = getattr(settings, "MERCADOPAGO_WEBHOOK_SECRET", None)

    # 1. Validação Estrita de HMAC-SHA256
    if not webhook_secret or not verify_mercadopago_signature(
        x_signature=x_signature or "",
        x_request_id=x_request_id or "",
        data_id=resource_id,
        secret=webhook_secret,
    ):
        logger.warning("[Webhook] Assinatura HMAC inválida ou segredo ausente na notificação.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Assinatura de Webhook inválida ou não configurada.",
        )

    # 2. Prevenção de Replay Attack via Redis (Idempotência TTL 24 horas)
    idempotency_key = f"webhook:processed:{resource_id}:{x_request_id or ''}"
    is_already_processed = await redis_cache.get(idempotency_key)
    if is_already_processed:
        logger.info(f"[Webhook] Evento duplicado ignorado (Idempotency Hit): {resource_id}")
        return {"status": "already_processed"}

    await redis_cache.set(idempotency_key, "1", expire_seconds=86400)

    event_type = notification.effective_action
    logger.info(f"[Webhook] Notificação autêntica recebida | Ação/Tópico: '{event_type}' | ID: '{resource_id}'")

    event_payload = WebhookEventPayload(
        topic=notification.type,
        action=notification.action,
        resource_id=resource_id,
        payload=notification,
        x_request_id=x_request_id,
    )

    # 3. Publicação Otimizada no RabbitMQ com Fila Declarada e Vínculo (Binding)
    try:
        connection = await get_rabbitmq_connection()
        async with connection:
            channel = await connection.channel()
            exchange = await channel.declare_exchange("billing_events", aio_pika.ExchangeType.DIRECT, durable=True)
            queue = await channel.declare_queue("mercadopago_webhooks", durable=True)
            await queue.bind(exchange, routing_key="payment_updates")

            await exchange.publish(
                aio_pika.Message(
                    body=event_payload.model_dump_json().encode("utf-8"),
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                ),
                routing_key="payment_updates",
            )
    except Exception as err:
        logger.error(f"[Webhook] Falha ao publicar evento na fila do RabbitMQ: {err}")

    return {"status": "received"}

