# app/core/config/rabbitmq.py
import logging
from typing import Dict
import aio_pika
from aio_pika import ExchangeType
from app.core.config.settings import settings

logger = logging.getLogger(__name__)


async def get_rabbitmq_connection() -> aio_pika.RobustConnection:
    """
    Estabelece uma conexão robusta com o RabbitMQ/CloudAMQP.
    Suporta reconexão automática e conexões criptografadas AMQPS.
    """
    rabbitmq_url = settings.RABBITMQ_URL

    # Alerta defensivo caso esteja em produção rodando sem AMQPS (TLS)
    if settings.ENVIRONMENT.lower() in ["production", "prod"] and not rabbitmq_url.startswith("amqps://"):
        logger.warning(
            "⚠️ ALERTA DE SEGURANÇA: A conexão RabbitMQ em produção não está utilizando protocolo TLS/AMQPS (amqps://)."
        )

    try:
        return await aio_pika.connect_robust(
            rabbitmq_url,
            heartbeat=60,      # Ping/pong a cada 60s para manter socket ativo em redes Cloud
            timeout=15,        # Timeout de conexão inicial
            client_properties={
                "connection_name": f"EcommerceBot-Worker-{settings.ENVIRONMENT}"
            }
        )
    except Exception as err:
        logger.error(f"Falha ao conectar ao RabbitMQ/CloudAMQP: {err}")
        raise err


async def configure_rabbitmq_topology(
    channel: aio_pika.abc.AbstractChannel
) -> Dict[str, aio_pika.abc.AbstractQueue]:
    """
    Configura a topologia do RabbitMQ estritamente para o escopo do Worker (Scraping, IA e ML):
    - Declaração de DLX (ecommerce_dlx) e DLQ com TTL de 7 dias
    - Filas de entrada de scraping e analytics ML
    - Filas de saída para persistência no Core API C#
    """
    try:
        # ------------------------------------------------------------------
        # 1. EXCHANGES DE DEAD LETTER (DLX) & DLQs
        # ------------------------------------------------------------------
        ecommerce_dlx = await channel.declare_exchange(
            "ecommerce_dlx",
            ExchangeType.DIRECT,
            durable=True
        )

        # DLQs guardam mensagens com falha por no máximo 7 dias (604.800.000 ms)
        dlq_args = {"x-message-ttl": 604800000}

        dlq_ecommerce = await channel.declare_queue(
            "dlq_ecommerce",
            durable=True,
            arguments=dlq_args
        )
        await dlq_ecommerce.bind(ecommerce_dlx, routing_key="ecommerce_failed")

        # ------------------------------------------------------------------
        # 2. FILAS DE ENTRADA DO WORKER (Consumidas pelo Python)
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
                "x-dead-letter-routing-key": "ecommerce_failed",
                "x-max-length": 10000
            }
        )

        analytics_ml_queue = await channel.declare_queue(
            "analytics_ml_queue",
            durable=True,
            arguments={
                "x-dead-letter-exchange": "ecommerce_dlx",
                "x-dead-letter-routing-key": "ecommerce_failed",
                "x-max-length": 1000
            }
        )

        # ------------------------------------------------------------------
        # 3. FILAS DE SAÍDA DO WORKER (Consumidas pelo Core .NET)
        # ------------------------------------------------------------------
        ecommerce_processed_queue = await channel.declare_queue(
            "ecommerce_processed_queue",
            durable=True
        )

        llm_usage_queue = await channel.declare_queue(
            "llm_usage_queue",
            durable=True
        )

        analytics_processed_queue = await channel.declare_queue(
            "analytics_processed_queue",
            durable=True
        )

        logger.info("Topologia RabbitMQ do AI/ML Worker provisionada com sucesso.")

        return {
            "demo_ecommerce": demo_ecommerce,
            "ecommerce": ecommerce,
            "ecommerce_processed_queue": ecommerce_processed_queue,
            "analytics_ml_queue": analytics_ml_queue,
            "analytics_processed_queue": analytics_processed_queue,
            "llm_usage_queue": llm_usage_queue,
            "dlq_ecommerce": dlq_ecommerce,
        }

    except Exception as e:
        logger.error(f"Erro ao configurar topologia do RabbitMQ no Worker: {e}")
        raise