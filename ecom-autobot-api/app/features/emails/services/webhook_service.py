import base64
import hashlib
import hmac
import json
from typing import Optional

from app.core.config.redis_db import redis_cache
from app.core.config.settings import settings
from app.core.shared.logger import get_logger
from app.features.emails.domain.entities import EmailStatus
from app.features.emails.domain.exceptions import InvalidWebhookSignatureError
from app.features.emails.repositories.email_repository import email_repository
from app.features.emails.schemas.webhook_schemas import ResendWebhookPayload


logger = get_logger("EmailWebhookService")

EVENT_STATUS_MAP = {
    "email.sent": EmailStatus.SENT,
    "email.delivered": EmailStatus.DELIVERED,
    "email.delivery_delayed": EmailStatus.DELIVERY_DELAYED,
    "email.bounced": EmailStatus.BOUNCED,
    "email.complained": EmailStatus.COMPLAINED,
    "email.opened": EmailStatus.OPENED,
    "email.clicked": EmailStatus.CLICKED,
}


class EmailWebhookService:
    """
    Serviço para validação criptográfica (Svix) e processamento atômico de webhooks do Resend.
    Garante idempotência de 24h no Redis e atualização de status em 'email_logs'.
    """

    def __init__(self) -> None:
        self.webhook_secret = getattr(settings, "RESEND_WEBHOOK_SECRET", None)

    def verify_signature(
        self,
        raw_body: bytes,
        svix_id: str,
        svix_timestamp: str,
        svix_signature: str,
    ) -> bool:
        """
        Valida a assinatura HMAC-SHA256 padrão Svix enviada pelo Resend.
        """
        if not self.webhook_secret:
            logger.warning("[WebhookService] RESEND_WEBHOOK_SECRET não configurado. Validação ignorada em dev.")
            return True

        if not (svix_id and svix_timestamp and svix_signature):
            raise InvalidWebhookSignatureError("Headers Svix ausentes na requisição.")

        # O segredo do Svix vem com o prefixo 'whsec_'
        secret = self.webhook_secret
        if secret.startswith("whsec_"):
            secret = secret[6:]

        try:
            secret_bytes = base64.b64decode(secret)
            to_sign = f"{svix_id}.{svix_timestamp}.".encode("utf-8") + raw_body
            expected_signature = hmac.new(secret_bytes, to_sign, hashlib.sha256).digest()
            expected_signature_b64 = base64.b64encode(expected_signature).decode("utf-8")

            # As assinaturas vêm separadas por espaço (ex: "v1,signature1 v1,signature2")
            passed_signatures = [
                sig.split(",")[1] if "," in sig else sig
                for sig in svix_signature.split(" ")
            ]

            is_valid = any(
                hmac.compare_digest(expected_signature_b64, passed_sig)
                for passed_sig in passed_signatures
            )

            if not is_valid:
                raise InvalidWebhookSignatureError("Assinatura Svix não confere com o payload.")
            return True

        except Exception as err:
            logger.warning(f"[WebhookService] Falha na validação de assinatura: {err}")
            raise InvalidWebhookSignatureError(f"Erro na verificação: {err}")

    async def process_webhook(
        self,
        raw_body: bytes,
        svix_id: str,
        svix_timestamp: str,
        svix_signature: str,
    ) -> bool:
        """Processa o evento do webhook de forma idempotente e atômica."""
        # 1. Validação Criptográfica
        self.verify_signature(raw_body, svix_id, svix_timestamp, svix_signature)

        # 2. Idempotência Distribuída no Redis (24 horas)
        lock_key = f"ecom:webhook:resend:{svix_id}"
        if redis_cache.redis_client:
            is_new_event = await redis_cache.redis_client.set(lock_key, "1", ex=86400, nx=True)
            if not is_new_event:
                logger.info(f"🔁 [WebhookService] Evento duplicado ignorado (svix_id: {svix_id}).")
                return True
        else:
            existing = await redis_cache.get(lock_key)
            if existing:
                logger.info(f"🔁 [WebhookService] Evento duplicado ignorado (svix_id: {svix_id}).")
                return True
            await redis_cache.set(lock_key, "1", expire_seconds=86400)

        # 3. Desserialização do Payload
        body_dict = json.loads(raw_body.decode("utf-8"))
        payload = ResendWebhookPayload.model_validate(body_dict)

        target_status = EVENT_STATUS_MAP.get(payload.type)
        if not target_status:
            logger.info(f"ℹ️ [WebhookService] Evento não mapeado ignorado: {payload.type}")
            return True

        resend_id = payload.data.email_id
        if not resend_id:
            logger.warning(f"[WebhookService] Evento {payload.type} sem email_id associado.")
            return False

        error_message = None
        if payload.type == "email.bounced" and payload.data.bounce:
            error_message = json.dumps(payload.data.bounce, ensure_ascii=False)

        # 4. Transição Atômica no PostgreSQL via EmailRepository
        updated_log = await email_repository.update_status_by_resend_id(
            resend_id=resend_id,
            new_status=target_status,
            metadata_update={
                "last_event": payload.type,
                "event_timestamp": payload.created_at.isoformat(),
            },
            error_message=error_message,
        )

        if updated_log:
            logger.info(
                f"📬 [WebhookService] Status do e-mail '{resend_id}' atualizado para '{target_status.value}'."
            )
        else:
            logger.warning(
                f"[WebhookService] Registro não localizado no banco para o resend_id '{resend_id}'."
            )

        return True


email_webhook_service = EmailWebhookService()