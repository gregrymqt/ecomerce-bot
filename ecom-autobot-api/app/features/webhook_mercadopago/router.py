import hashlib
import hmac
import logging
import re
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException, Query, Request, status
import aio_pika

from app.core.config.rabbitmq import get_rabbitmq_connection
from app.core.config.settings import settings
from app.features.webhook_mercadopago.schemas import (
    MercadoPagoNotificationPayload,
    WebhookEventPayload,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

# Regex pré-compilado para extração rápida de ts e v1 em O(1) sem alocação de dicts temporários
TS_V1_REGEX = re.compile(r"(?:ts=(\d+))|(?:v1=([a-fA-F0-9]+))")


def verify_mercadopago_signature(
    x_signature: str,
    x_request_id: str,
    data_id: str,
    secret: str,
) -> bool:
    """
    Valida a autenticidade da notificação Webhook utilizando HMAC-SHA256
    com extração otimizada em tempo O(1) sem alocações desnecessárias na Heap.
    """
    if not x_signature or not secret:
        return False

    try:
        ts: Optional[str] = None
        v1: Optional[str] = None

        # Extração em O(1) com consumo mínimo de memória
        for match in TS_V1_REGEX.finditer(x_signature):
            if match.group(1):
                ts = match.group(1)
            elif match.group(2):
                v1 = match.group(2)

        if not ts or not v1:
            return False

        clean_data_id = str(data_id).lower() if data_id else ""

        # Formatação direta de string em alocação única
        manifest = f"id:{clean_data_id};" if clean_data_id else ""
        if x_request_id:
            manifest += f"request-id:{x_request_id};"
        manifest += f"ts:{ts};"

        computed_signature = hmac.new(
            secret.encode("utf-8"),
            manifest.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(computed_signature, v1)
    except Exception as err:
        logger.error(f"[Webhook] Erro ao validar assinatura do Mercado Pago: {err}")
        return False


@router.post(
    "/mercadopago",
    status_code=status.HTTP_200_OK,
    summary="Receptor de Webhooks do Mercado Pago (Otimizado)",
    description="Recebe notificações de pagamentos e assinaturas com validação otimizada HMAC e publicação assíncrona no RabbitMQ.",
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

    if webhook_secret and not verify_mercadopago_signature(
        x_signature=x_signature or "",
        x_request_id=x_request_id or "",
        data_id=resource_id,
        secret=webhook_secret,
    ):
        logger.warning("[Webhook] Assinatura inválida recebida na notificação do Mercado Pago.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Assinatura de Webhook inválida.",
        )

    event_type = notification.effective_action
    logger.info(f"[Webhook] Notificação autêntica recebida | Ação/Tópico: '{event_type}' | ID: '{resource_id}'")

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
            exchange = await channel.declare_exchange("billing_events", aio_pika.ExchangeType.DIRECT, durable=True)

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
