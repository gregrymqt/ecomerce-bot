import hmac
import hashlib
import json
import logging
from typing import Dict, Optional
import aio_pika
from fastapi import HTTPException, status

from app.core.config.settings import settings
from app.core.config.redis_db import redis_cache
from app.core.config.rabbitmq import get_rabbitmq_connection

logger = logging.getLogger(__name__)


class NuvemshopWebhookService:
    """
    Serviço de Domínio para Recepção, Validação HMAC, Idempotência e Enfileiramento de Webhooks da Nuvemshop.
    """

    @staticmethod
    def verify_hmac(raw_body: bytes, hmac_header: Optional[str], secret: str) -> bool:
        """
        Valida a assinatura HMAC SHA256 enviada pela Nuvemshop no header 'x-linkedstore-hmac-sha256'.
        """
        if not secret or not hmac_header or not raw_body:
            return False

        try:
            computed_hmac = hmac.new(
                secret.encode("utf-8"),
                raw_body,
                hashlib.sha256,
            ).hexdigest()

            return hmac.compare_digest(computed_hmac.lower(), hmac_header.strip().lower())
        except Exception as e:
            logger.error(f"[Nuvemshop Webhook Service] Erro ao calcular HMAC SHA256: {e}")
            return False

    async def enqueue_webhook_event(
        self,
        payload: Dict,
        raw_body: bytes,
        hmac_header: Optional[str],
    ) -> Dict[str, str]:
        webhook_secret = getattr(settings, "NUVEMSHOP_WEBHOOK_SECRET", "") or getattr(settings, "NUVEMSHOP_CLIENT_SECRET", "")

        # 1. Validação Estrita de HMAC (se segredo estiver configurado em produção)
        if webhook_secret and hmac_header:
            if not self.verify_hmac(raw_body, hmac_header, webhook_secret):
                logger.warning("[Nuvemshop Webhook Service] Falha de autenticação: Assinatura HMAC inválida.")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Assinatura HMAC inválida para o webhook da Nuvemshop.",
                )

        store_id = str(payload.get("store_id", payload.get("store", "")))
        event = str(payload.get("event", payload.get("topic", "")))
        event_id = str(payload.get("id", payload.get("event_id", "")))

        # 2. Verificação de Idempotência no Redis (TTL de 24 horas = 86400s)
        if store_id and event and event_id:
            redis_key = f"ecom:nuvemshop_event:{store_id}:{event}:{event_id}"
            if redis_cache.redis_client:
                already_processed = await redis_cache.redis_client.get(redis_key)
                if already_processed:
                    logger.info(f"[Nuvemshop Webhook Service] Evento duplicado ignorado (Idempotency Hit): {redis_key}")
                    return {"status": "already_processed"}

                await redis_cache.redis_client.set(redis_key, "1", ex=86400)

        # 3. Envelope da mensagem para enfileiramento
        envelope = {
            "provider": "nuvemshop",
            "store_id": store_id,
            "event": event,
            "event_id": event_id,
            "payload": payload,
        }

        # 4. Publicação no RabbitMQ na fila 'nuvemshop_webhook'
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
                    routing_key="nuvemshop_webhook",
                )
                logger.info(f"[Nuvemshop Webhook Service] Evento '{event}' da loja '{store_id}' enfileirado com sucesso em 'nuvemshop_webhook'.")
        except Exception as err:
            logger.error(f"[Nuvemshop Webhook Service] Erro ao publicar evento no RabbitMQ: {err}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Falha no enfileiramento de webhook: {str(err)}",
            )

        return {"status": "queued"}
