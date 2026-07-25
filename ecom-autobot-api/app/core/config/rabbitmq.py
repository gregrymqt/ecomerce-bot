from ast import arg
import logging
from typing import Dict
import aio_pika
from aio_pika import ExchangeType
from app.core.config.settings import settings

logger = logging.getLogger(__name__)

async def get_rabbitmq_connection() -> aio_pika.RobustConnection:
    return await aio_pika.connect_robust(
        settings.RABBITMQ_URL,
        heartbeat=60,  # Garante ping/pong a cada 60s
        timeout=15     # Timeout de conexão inicial
    )

async def configure_rabbitmq_topology(
    channel: aio_pika.abc.AbstractChannel
) -> Dict[str, aio_pika.abc.AbstractQueue]:
    """
    Configura a topologia completa do RabbitMQ com 7 filas e isolamento de DLQ
    para operações de scraping/LLM e transações financeiras.
    """
    try:
        # ------------------------------------------------------------------
        # 1. EXCHANGES DE DEAD LETTER (DLX)
        # ------------------------------------------------------------------
        ecommerce_dlx = await channel.declare_exchange(
            "ecommerce_dlx",
            ExchangeType.DIRECT,
            durable=True
        )

        mercadopago_dlx = await channel.declare_exchange(
            "mercadopago_dlx",
            ExchangeType.DIRECT,
            durable=True
        )

        llm_dlx = await channel.declare_exchange(
            "llm_dlx",
            ExchangeType.DIRECT,
            durable=True
        )

        # ------------------------------------------------------------------
        # 2. DEAD LETTER QUEUES (DLQs)
        # ------------------------------------------------------------------
        dlq_ecommerce = await channel.declare_queue(
            "dlq_ecommerce",
            durable=True
        )
        await dlq_ecommerce.bind(ecommerce_dlx, routing_key="ecommerce_failed")

        dlq_mercado_pago = await channel.declare_queue(
            "dlq_mercado_pago",
            durable=True
        )
        await dlq_mercado_pago.bind(mercadopago_dlx, routing_key="mp_failed")

        dlq_llm = await channel.declare_queue(
            "dlq_llm",
            durable=True
        )
        await dlq_llm.bind(llm_dlx, routing_key="llm_failed")

        # ------------------------------------------------------------------
        # 3. FILAS DE E-COMMERCE & DEMO (SCRAPING E LLM)
        # ------------------------------------------------------------------
        demo_ecommerce = await channel.declare_queue(
            "demo_ecommerce",
            durable=True,
            arguments={
                "x-dead-letter-exchange": "ecommerce_dlx",
                "x-dead-letter-routing-key": "ecommerce_failed",
                "x-max-priority": 10,
                "x-max-length": 100
            }
        )

        ecommerce = await channel.declare_queue(
            "ecommerce",
            durable=True,
            arguments={
                "x-dead-letter-exchange": "ecommerce_dlx",
                "x-dead-letter-routing-key": "ecommerce_failed"
            }
        )

        # ------------------------------------------------------------------
        # 4. FILAS FINANCEIRAS & WEBHOOKS (MERCADO PAGO)
        # ------------------------------------------------------------------
        webhook = await channel.declare_queue(
            "webhook",
            durable=True,
            arguments={
                "x-dead-letter-exchange": "mercadopago_dlx",
                "x-dead-letter-routing-key": "mp_failed"
            }
        )

        payments = await channel.declare_queue(
            "payments",
            durable=True,
            arguments={
                "x-dead-letter-exchange": "mercadopago_dlx",
                "x-dead-letter-routing-key": "mp_failed"
            }
        )

        subscription = await channel.declare_queue(
            "subscription",
            durable=True,
            arguments={
                "x-dead-letter-exchange": "mercadopago_dlx",
                "x-dead-letter-routing-key": "mp_failed"
            }
        )

        # ------------------------------------------------------------------
        # 5. FILAS LLM (PRODUÇÃO & DEMO)
        # ------------------------------------------------------------------
        llm = await channel.declare_queue(
            "llm", 
            durable=True,
            arguments={
                "x-dead-letter-exchange": "llm_dlx",
                "x-dead-letter-routing-key": "llm_failed"
            }
        )

        demo_llm = await channel.declare_queue(
            "demo_llm", 
            durable=True,
            arguments={
                "x-dead-letter-exchange": "llm_dlx",
                "x-dead-letter-routing-key": "llm_failed",
                "x-max-priority": 10,
                "x-max-length": 100
            }
        )

        logger.info("RabbitMQ topology (7 queues & 2 DLXs) configured successfully.")

        # Retornar dicionário facilita o consumo posterior na inicialização de Workers
        return {
            "demo_ecommerce": demo_ecommerce,
            "ecommerce": ecommerce,
            "webhook": webhook,
            "payments": payments,
            "subscription": subscription,
            "demo_llm": demo_llm,
            "llm": llm,
            "dlq_ecommerce": dlq_ecommerce,
            "dlq_mercado_pago": dlq_mercado_pago,
            "dlq_llm": dlq_llm,
        }

    except Exception as e:
        logger.error(f"Error configuring RabbitMQ topology: {e}")
        raise