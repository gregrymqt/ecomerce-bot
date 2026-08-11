import json
import asyncio
from typing import Any, Dict
import aio_pika

from app.core.config.rabbitmq import get_rabbitmq_connection
from app.features.emails.services.email_service import email_service
from app.core.shared.logger import get_logger

logger = get_logger("EmailWorker")

# Mapeamento estático do evento de negócio para a configuração de template e assunto
TEMPLATE_MAP: Dict[str, Dict[str, str]] = {
    "USER_WELCOME": {
        "template": "welcome.html",
        "subject": "Bem-vindo ao ECom AutoBot! 🚀",
    },
    "RECHARGE_CONFIRMED": {
        "template": "recharge_approved.html",
        "subject": "Sua recarga de créditos foi confirmada! 🎉",
    },
    "LOW_BALANCE_ALERT": {
        "template": "low_balance.html",
        "subject": "Atenção: Saldo de créditos baixo ⚠️",
    },
    "ZERO_BALANCE_BLOCK": {
        "template": "low_balance.html",
        "subject": "Aviso: Tentativa de uso com saldo zerado 🚨",
    },
    "BATCH_PROCESSING_COMPLETED": {
        "template": "batch_completed.html",
        "subject": "Seu lote de produtos foi processado! 🚀",
    },
    "EXTERNAL_CREDENTIAL_ERROR": {
        "template": "integration_error.html",
        "subject": "Falha na integração com e-commerce 🚨",
    },
    "BYOK_KEY_INVALID": {
        "template": "integration_error.html",
        "subject": "Sua chave de API de IA precisa de atenção 🚨",
    },
}


class EmailWorker:
    """
    Worker Consumidor de Fila (DDD Worker Component) para envio assíncrono de e-mails transacionais.
    Escuta a fila 'email_notifications' do RabbitMQ e aciona o EmailService.
    """

    def __init__(self) -> None:
        self.queue_name = "email_notifications"

    async def process_message(self, message: aio_pika.IncomingMessage) -> None:
        async with message.process(requeue=False, ignore_processed=True):
            try:
                body: Dict[str, Any] = json.loads(message.body.decode("utf-8"))
                event_name = body.get("event")
                recipient_email = body.get("recipient_email")
                data = body.get("data", {})

                config = TEMPLATE_MAP.get(event_name)
                if not config:
                    logger.warning(f"[EmailWorker] Evento desconhecido '{event_name}'. Mensagem descartada.")
                    return

                context = {
                    "user_name": body.get("recipient_name", "Cliente"),
                    "tenant_id": body.get("tenant_id"),
                    **data,
                }

                await email_service.send_email(
                    to_email=recipient_email,
                    subject=config["subject"],
                    template_name=config["template"],
                    context=context,
                )

            except Exception as exc:
                logger.error(f"[EmailWorker] Erro ao processar envio de e-mail: {str(exc)}", exc_info=True)
                raise exc

    async def start_consuming(self, queue_name: str = "email_notifications", channel: aio_pika.abc.AbstractChannel = None) -> None:
        """
        Inicia a escuta da fila com suporte a reutilização de canal RabbitMQ (ex: lifespan do main.py).
        """
        try:
            if channel is None:
                connection = await get_rabbitmq_connection()
                channel = await connection.channel()

            await channel.set_qos(prefetch_count=10)
            queue = await channel.get_queue(queue_name)

            logger.info(f"🚀 EmailWorker escutando a fila '{queue_name}'...")

            async with queue.iterator() as queue_iter:
                async for message in queue_iter:
                    await self.process_message(message)

        except Exception as e:
            logger.error(f"Erro assíncrono na conexão/consumo do RabbitMQ no EmailWorker: {e}")


if __name__ == "__main__":
    async def main():
        worker = EmailWorker()
        await worker.start_consuming()

    loop = asyncio.get_event_loop()
    loop.run_until_complete(main())
