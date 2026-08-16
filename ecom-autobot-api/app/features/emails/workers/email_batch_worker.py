import asyncio
import json
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import aio_pika
import httpx

from app.core.config.rabbitmq import get_rabbitmq_connection
from app.core.config.settings import settings
from app.core.shared.logger import get_logger
from app.features.emails.domain.entities import EmailLog, EmailStatus
from app.features.emails.infrastructure.resend_client import resend_client
from app.features.emails.repositories.email_repository import email_repository
from app.features.emails.schemas.email_schemas import EmailEventPayload
from app.features.emails.schemas.resend_schemas import ResendSendEmailRequest, ResendTag
from app.features.emails.services.email_template_service import template_service

logger = get_logger("EmailBatchWorker")


@dataclass
class BufferedEmailItem:
    """Container para mensagem pendente de envio em lote."""
    message: aio_pika.IncomingMessage
    payload: EmailEventPayload
    request_dto: ResendSendEmailRequest
    subject: str


class EmailBatchWorker:
    """
    Worker Assíncrono com Buffer Híbrido (Volume + Tempo) para envio em lote via Resend API.
    Acumula até BATCH_SIZE mensagens ou dispara o flush a cada MAX_WAIT_SECONDS.
    Garante manual ACK no RabbitMQ e persistência atômica de resend_id no PostgreSQL.
    """

    def __init__(
        self,
        queue_name: str = "email_notifications",
        batch_size: int = 50,
        max_wait_seconds: float = 1.0,
    ) -> None:
        self.queue_name = queue_name
        self.batch_size = min(batch_size, 100)  # Limite máximo de 100 suportado pelo Resend
        self.max_wait_seconds = max_wait_seconds
        self._buffer: List[BufferedEmailItem] = []
        self._lock = asyncio.Lock()
        self._last_flush_time: float = time.monotonic()
        self._from_email = getattr(
            settings, "EMAIL_FROM", "ECom AutoBot <notificacoes@ecommercebot.com>"
        )

    def _prepare_item(self, message: aio_pika.IncomingMessage) -> Optional[BufferedEmailItem]:
        """Desserializa o payload do RabbitMQ e monta o DTO do Resend com tags de correlação."""
        try:
            body_dict = json.loads(message.body.decode("utf-8"))
            event_payload = EmailEventPayload.model_validate(body_dict)

            template_name, subject = template_service.resolve_event(event_payload.event)
            context = {
                "user_name": event_payload.recipient_name,
                "tenant_id": event_payload.tenant_id,
                **event_payload.data,
            }
            html_content = template_service.render(template_name, context)

            resend_req = ResendSendEmailRequest(
                from_email=self._from_email,
                to=[event_payload.recipient_email],
                subject=subject,
                html=html_content,
                tags=[
                    ResendTag(name="tenant_id", value=event_payload.tenant_id),
                    ResendTag(name="event_type", value=event_payload.event),
                    ResendTag(name="idempotency_key", value=event_payload.idempotency_key or "none"),
                ],
            )
            return BufferedEmailItem(
                message=message,
                payload=event_payload,
                request_dto=resend_req,
                subject=subject,
            )
        except Exception as err:
            logger.error(f"[EmailBatchWorker] Erro ao preparar item da fila: {err}", exc_info=True)
            return None

    async def _flush_buffer(self, http_client: httpx.AsyncClient) -> None:
        """Executa o disparo em lote no Resend, grava os logs no banco e confirma as mensagens na fila."""
        async with self._lock:
            if not self._buffer:
                self._last_flush_time = time.monotonic()
                return

            items_to_process = list(self._buffer)
            self._buffer.clear()
            self._last_flush_time = time.monotonic()

        batch_requests = [item.request_dto for item in items_to_process]
        logger.info(f"🚀 [EmailBatchWorker] Despachando lote de {len(batch_requests)} e-mails para o Resend...")

        try:
            # 1. Envio em Lote via Resend API
            batch_resp = await resend_client.send_batch(batch_requests, client=http_client)
            resend_results = batch_resp.data

            # 2. Montagem das Entidades para Persistência Atômica
            logs_to_insert: List[EmailLog] = []
            for idx, item in enumerate(items_to_process):
                assigned_resend_id = resend_results[idx].id if idx < len(resend_results) else None
                log_entry = EmailLog(
                    tenant_id=item.payload.tenant_id,
                    resend_id=assigned_resend_id,
                    recipient=item.payload.recipient_email,
                    event_type=item.payload.event,
                    status=EmailStatus.SENT if assigned_resend_id else EmailStatus.FAILED,
                    subject=item.subject,
                    idempotency_key=item.payload.idempotency_key,
                    metadata_info={"context_keys": list(item.payload.data.keys())},
                )
                logs_to_insert.append(log_entry)

            # 3. Persistência no PostgreSQL
            await email_repository.create_batch(logs=logs_to_insert)

            # 4. Confirmação Manual (ACK) no RabbitMQ
            ack_tasks = [item.message.ack() for item in items_to_process]
            await asyncio.gather(*ack_tasks, return_exceptions=True)

            logger.info(
                f"✅ [EmailBatchWorker] Lote de {len(items_to_process)} e-mails processado e confirmado com sucesso."
            )

        except Exception as batch_err:
            logger.error(
                f"💥 [EmailBatchWorker] Falha crítica ao processar lote de e-mails: {batch_err}. "
                f"Reenfileirando mensagens (NACK com requeue=True)...",
                exc_info=True,
            )
            # Rejeita e devolve para a fila para nova tentativa em caso de falha transitória
            nack_tasks = [item.message.nack(requeue=True) for item in items_to_process]
            await asyncio.gather(*nack_tasks, return_exceptions=True)

    async def _timer_flusher(self, http_client: httpx.AsyncClient) -> None:
        """Loop de background para garantir flush por tempo mesmo sem lote cheio."""
        while True:
            try:
                await asyncio.sleep(0.3)
                elapsed = time.monotonic() - self._last_flush_time
                if self._buffer and elapsed >= self.max_wait_seconds:
                    await self._flush_buffer(http_client)
            except asyncio.CancelledError:
                break
            except Exception as err:
                logger.error(f"[EmailBatchWorker] Erro no timer de flush: {err}", exc_info=True)

    async def start_consuming(
        self, queue_name: str = "email_notifications", channel: aio_pika.abc.AbstractChannel | None = None
    ) -> None:
        """Inicia a escuta da fila com prefetch ajustado e pooling HTTP compartilhado."""
        self.queue_name = queue_name or self.queue_name
        if channel is None:
            connection = await get_rabbitmq_connection()
            channel = await connection.channel()

        # Prefetch deve acomodar no mínimo o tamanho do lote
        await channel.set_qos(prefetch_count=self.batch_size * 2)
        queue = await channel.get_queue(self.queue_name)

        logger.info(
            f"📧 [EmailBatchWorker] Escutando '{self.queue_name}' (Batch: {self.batch_size}, Timeout: {self.max_wait_seconds}s)..."
        )

        async with httpx.AsyncClient(timeout=30.0) as http_client:
            flusher_task = asyncio.create_task(self._timer_flusher(http_client))

            try:
                async with queue.iterator() as queue_iter:
                    async for message in queue_iter:
                        item = self._prepare_item(message)
                        if not item:
                            # Descarta mensagens corrompidas que não podem ser parseadas
                            await message.reject(requeue=False)
                            continue

                        async with self._lock:
                            self._buffer.append(item)
                            should_flush = len(self._buffer) >= self.batch_size

                        if should_flush:
                            await self._flush_buffer(http_client)

            except asyncio.CancelledError:
                logger.info("🛑 [EmailBatchWorker] Encerrando worker e drenando buffer pendente...")
                if self._buffer:
                    await self._flush_buffer(http_client)
                flusher_task.cancel()
                raise
            finally:
                if not flusher_task.done():
                    flusher_task.cancel()


email_batch_worker = EmailBatchWorker()