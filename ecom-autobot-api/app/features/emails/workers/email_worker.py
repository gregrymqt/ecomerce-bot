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
    Projetado com alta resiliência para rodar no event loop principal da aplicação.
    """

    def __init__(self) -> None:
        self.queue_name = "email_notifications"

    async def _process_single_email(self, message: aio_pika.IncomingMessage) -> None:
        """Processa a desserialização e o disparo do e-mail para um único evento."""
        body: Dict[str, Any] = json.loads(message.body.decode("utf-8"))
        event_name = body.get("event")
        recipient_email = body.get("recipient_email")
        data = body.get("data", {})

        config = TEMPLATE_MAP.get(event_name)
        if not config:
            logger.warning(f"⚠️ [EmailWorker] Evento desconhecido '{event_name}' recebido. Mensagem ignorada.")
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

    async def process_message(self, message: aio_pika.IncomingMessage) -> None:
        """Wrapper de compatibilidade para processamento de mensagem individual com requeue=False."""
        async with message.process(requeue=False, ignore_processed=True):
            await self._process_single_email(message)

    async def start_consuming(
        self, queue_name: str = "email_notifications", channel: aio_pika.abc.AbstractChannel = None
    ) -> None:
        """
        Inicia a escuta da fila com suporte a reutilização de canal RabbitMQ (lifespan do main.py).
        Envolve a iteração de cada mensagem em um bloco try/except robusto com nack(requeue=False)
        para garantir que falhas isoladas de mensagens nunca cancelem a asyncio.Task do worker.
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
                    try:
                        async with message.process(requeue=False, ignore_processed=True):
                            await self._process_single_email(message)
                    except asyncio.CancelledError:
                        raise
                    except Exception as msg_err:
                        logger.error(
                            f"💥 [EmailWorker] Erro ao processar evento de e-mail na fila '{queue_name}': {msg_err}. "
                            f"Mensagem descartada/enviada para a DLQ sem interromper a Task do worker.",
                            exc_info=True,
                        )
                        try:
                            await message.nack(requeue=False)
                        except Exception:
                            pass

        except asyncio.CancelledError:
            logger.info("🛑 [EmailWorker] Task do worker encerrada graciosamente (lifespan shutdown).")
            raise
        except Exception as e:
            logger.error(f"🚨 [EmailWorker] Erro crítico na conexão ou no consumo do RabbitMQ: {e}", exc_info=True)


if __name__ == "__main__":
    import asyncio

    async def main():
        worker = EmailWorker()
        await worker.start_consuming()

    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("🛑 Worker interrompido manualmente.")
