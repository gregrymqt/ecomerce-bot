import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import aio_pika

from app.core.config.rabbitmq import get_rabbitmq_connection
from app.core.config.redis_db import redis_cache
from app.core.config.settings import settings
from app.features.nuvemshop.domain import (
    NuvemshopSignatureError,
    NuvemshopWebhookProcessingError,
    NuvemshopWebhookStatus,
)
from app.features.nuvemshop.repositories.nuvemshop_repository import nuvemshop_repository
from app.features.nuvemshop.schemas.nuvemshop_webhook_schemas import NuvemshopWebhookQueueMessage

logger = logging.getLogger(__name__)


class NuvemshopWebhookService:
    """
    Serviço de Aplicação para Recepção, Validação HMAC, Idempotência, Auditoria no DB e Enfileiramento.
    Desacoplado de exceções HTTP da camada de apresentação.
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
        payload: Dict[str, Any],
        raw_body: bytes,
        hmac_header: Optional[str],
        queue_name: str = "nuvemshop_webhook",
    ) -> Dict[str, str]:
        webhook_secret = getattr(settings, "NUVEMSHOP_WEBHOOK_SECRET", "") or getattr(settings, "NUVEMSHOP_CLIENT_SECRET", "")

        # 1. Validação Estrita de HMAC-SHA256
        if webhook_secret and hmac_header:
            if not self.verify_hmac(raw_body, hmac_header, webhook_secret):
                logger.warning("[Nuvemshop Webhook Service] Falha de autenticação: Assinatura HMAC inválida.")
                raise NuvemshopSignatureError("Assinatura HMAC inválida para o webhook da Nuvemshop.")

        store_id_raw = payload.get("store_id", payload.get("store", 0))
        store_id = int(store_id_raw) if str(store_id_raw).isdigit() else 0
        event = str(payload.get("event", payload.get("topic", "")))
        resource_id_raw = payload.get("id", payload.get("event_id", payload.get("resource_id")))
        resource_id = int(resource_id_raw) if resource_id_raw and str(resource_id_raw).isdigit() else None

        event_id = f"{store_id}:{event}:{resource_id or 'none'}"

        # 2. Verificação de Idempotência no Redis (TTL de 24 horas)
        if store_id and event:
            redis_key = f"ecom:webhook:nuvemshop:{event_id}"
            try:
                already_processed = await redis_cache.get(redis_key)
                if already_processed:
                    logger.info(f"ℹ️ [Nuvemshop Webhook Service] Evento duplicado ignorado (Idempotency Hit): {redis_key}")
                    return {"status": "received", "message": "Evento já registrado anteriormente."}

                await redis_cache.set(redis_key, "1", expire_seconds=86400)
            except Exception as cache_err:
                logger.warning(f"⚠️ [Nuvemshop Webhook Service] Falha ao ler/gravar trava no Redis: {cache_err}")

        # 3. Auditoria de Entrada no PostgreSQL
        try:
            await nuvemshop_repository.log_webhook_event(
                store_id=store_id,
                event_id=event_id,
                event=event,
                resource_id=resource_id,
                payload=payload,
                status=NuvemshopWebhookStatus.RECEIVED,
            )
        except Exception as log_err:
            logger.warning(f"⚠️ [Nuvemshop Webhook Service] Falha ao registrar log de auditoria no DB: {log_err}")

        # 4. Envelope serializado da mensagem para enfileiramento
        msg_payload = NuvemshopWebhookQueueMessage(
            event_id=event_id,
            store_id=store_id,
            event=event,
            resource_id=resource_id,
            payload=payload,
            received_at=datetime.now(timezone.utc).isoformat(),
        )

        # 5. Publicação no RabbitMQ na fila 'nuvemshop_webhook'
        try:
            connection = await get_rabbitmq_connection()
            async with connection:
                channel = await connection.channel()
                await channel.default_exchange.publish(
                    aio_pika.Message(
                        body=json.dumps(msg_payload.model_dump()).encode("utf-8"),
                        content_type="application/json",
                        delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                    ),
                    routing_key=queue_name,
                )
                logger.info(f"✅ [Nuvemshop Webhook Service] Evento '{event}' da loja '{store_id}' enfileirado com sucesso em '{queue_name}'.")
        except Exception as err:
            logger.error(f"❌ [Nuvemshop Webhook Service] Erro ao publicar evento no RabbitMQ: {err}", exc_info=True)
            raise NuvemshopWebhookProcessingError(f"Falha no enfileiramento de webhook: {str(err)}")

        return {"status": "received"}


nuvemshop_webhook_service = NuvemshopWebhookService()
