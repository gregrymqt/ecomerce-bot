import logging
import aio_pika
from aio_pika import ExchangeType
from app.config.settings import settings

logger = logging.getLogger(__name__)

async def get_rabbitmq_connection() -> aio_pika.RobustConnection:
    return await aio_pika.connect_robust(settings.RABBITMQ_URL)

async def configure_rabbitmq_topology(channel: aio_pika.abc.AbstractChannel):
    """
    Configura a topologia de mensageria do RabbitMQ para suportar multi-tenant 
    (Freemium/Pagantes) e garantir resiliência com Dead Letter Exchanges (DLX).
    """
    try:
        # Exchange de Dead Letter
        dlx = await channel.declare_exchange(
            "ecommerce_dlx",
            ExchangeType.DIRECT,
            durable=True
        )

        # Fila de Dead Letter (DLQ)
        dlq = await channel.declare_queue(
            "ecommerce_dead_letter",
            durable=True
        )
        await dlq.bind(dlx, routing_key="failed")

        # Fila de Produção (ecommerce_prod): lojistas pagantes (BYOK)
        prod_queue = await channel.declare_queue(
            "ecommerce_prod",
            durable=True,
            arguments={
                "x-dead-letter-exchange": "ecommerce_dlx",
                "x-dead-letter-routing-key": "failed"
            }
        )

        # Fila de Demonstração (ecommerce_demo): leads da Landing Page
        demo_queue = await channel.declare_queue(
            "ecommerce_demo",
            durable=True,
            arguments={
                "x-dead-letter-exchange": "ecommerce_dlx",
                "x-dead-letter-routing-key": "failed",
                "x-max-priority": 10,
                "x-max-length": 100
            }
        )
        
        logger.info("RabbitMQ topology configured successfully.")
        return prod_queue, demo_queue
    except Exception as e:
        logger.error(f"Error configuring RabbitMQ topology: {e}")
        raise
