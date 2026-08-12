import json
import logging
from typing import Dict, Optional
import aio_pika
from fastapi import HTTPException, status

from app.core.config.settings import settings
from app.core.config.redis_db import redis_cache
from app.core.config.rabbitmq import get_rabbitmq_connection
from app.features.shopify.infrastructure.security import verify_shopify_webhook_hmac

logger = logging.getLogger(__name__)


class ShopifyWebhookService:
    """
    Serviço de Domínio para Recepção, Validação e Enfileiramento de Webhooks da Shopify.
    Encapsula as regras de validação HMAC, verificação de idempotência e publicação no RabbitMQ.
    """

    async def process_incoming_webhook(
        self,
        raw_body: bytes,
        hmac_header: Optional[str],
        webhook_id: Optional[str],
        shop_domain: Optional[str],
        topic: Optional[str],
    ) -> Dict[str, str]:
        webhook_secret = getattr(settings, "SHOPIFY_WEBHOOK_SECRET", "")

        # 1. Validação Estrita de HMAC-SHA256
        if not webhook_secret or not hmac_header or not verify_shopify_webhook_hmac(raw_body, hmac_header, webhook_secret):
            logger.warning("[Shopify Webhook Service] Assinatura HMAC inválida ou segredo não configurado.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Assinatura HMAC inválida",
            )

        # 2. Verificação de Idempotência no Redis (TTL de 24 horas)
        effective_webhook_id = webhook_id or ""
        if effective_webhook_id:
            redis_key = f"shopify:webhook:{effective_webhook_id}"
            is_already_processed = await redis_cache.get(redis_key)
            if is_already_processed:
                logger.info(f"[Shopify Webhook Service] Evento duplicado ignorado (Idempotency Hit): {effective_webhook_id}")
                return {"status": "already_processed"}

            await redis_cache.set(redis_key, "1", expire_seconds=86400)

        # 3. Construção do Envelope do Evento
        try:
            payload_data = json.loads(raw_body.decode("utf-8")) if raw_body else {}
        except Exception:
            payload_data = {}

        envelope = {
            "provider": "shopify",
            "event_id": effective_webhook_id,
            "topic": topic or "",
            "shop_domain": shop_domain or "",
            "payload": payload_data,
        }

        # 4. Publicação não-bloqueante na fila 'webhook' do RabbitMQ
        try:
            connection = await get_rabbitmq_connection()
            async with connection:
                channel = await connection.channel()
                await channel.default_exchange.publish(
                    aio_pika.Message(
                        body=json.dumps(envelope).encode("utf-8"),
                        content_type="application/json",
                        delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                    ),
                    routing_key="shopify_webhook",
                )
                logger.info(f"[Shopify Webhook Service] Evento '{topic}' do lojista '{shop_domain}' enfileirado na fila 'shopify_webhook'.")
        except Exception as err:
            logger.error(f"[Shopify Webhook Service] Falha ao publicar evento no RabbitMQ: {err}")

        return {"status": "queued"}
