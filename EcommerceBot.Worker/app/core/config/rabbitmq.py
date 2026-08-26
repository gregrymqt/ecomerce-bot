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
                "connection_name": f"EcommerceBot-{settings.ENVIRONMENT}"
            }
        )
    except Exception as err:
        logger.error(f"Falha ao conectar ao RabbitMQ/CloudAMQP: {err}")
        raise err


async def configure_rabbitmq_topology(
    channel: aio_pika.abc.AbstractChannel
) -> Dict[str, aio_pika.abc.AbstractQueue]:
    """
    Configura a topologia completa do RabbitMQ com filas principais e isolamentos de DLQ
    para operações de scraping, IA, Machine Learning e transações financeiras.
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

        shopify_dlx = await channel.declare_exchange(
            "shopify_dlx",
            ExchangeType.DIRECT,
            durable=True
        )

        nuvemshop_dlx = await channel.declare_exchange(
            "nuvemshop_dlx",
            ExchangeType.DIRECT,
            durable=True
        )

        # ------------------------------------------------------------------
        # 2. DEAD LETTER QUEUES (DLQs - Com TTL de expiração para limpeza)
        # ------------------------------------------------------------------
        # DLQs guardam mensagens com falha por no máximo 7 dias (604.800.000 ms)
        dlq_args = {"x-message-ttl": 604800000}

        dlq_ecommerce = await channel.declare_queue(
            "dlq_ecommerce",
            durable=True,
            arguments=dlq_args
        )
        await dlq_ecommerce.bind(ecommerce_dlx, routing_key="ecommerce_failed")

        dlq_mercado_pago = await channel.declare_queue(
            "dlq_mercado_pago",
            durable=True,
            arguments=dlq_args
        )
        await dlq_mercado_pago.bind(mercadopago_dlx, routing_key="mp_failed")

        dlq_llm = await channel.declare_queue(
            "dlq_llm",
            durable=True,
            arguments=dlq_args
        )
        await dlq_llm.bind(llm_dlx, routing_key="llm_failed")

        dlq_shopify = await channel.declare_queue(
            "dlq_shopify",
            durable=True,
            arguments=dlq_args
        )
        await dlq_shopify.bind(shopify_dlx, routing_key="shopify_failed")

        dlq_nuvemshop = await channel.declare_queue(
            "dlq_nuvemshop",
            durable=True,
            arguments=dlq_args
        )
        await dlq_nuvemshop.bind(nuvemshop_dlx, routing_key="nuvemshop_failed")

        dlq_nuvemshop_bulk_sync = await channel.declare_queue(
            "dlq_nuvemshop_bulk_sync",
            durable=True,
            arguments=dlq_args
        )
        await dlq_nuvemshop_bulk_sync.bind(nuvemshop_dlx, routing_key="dlq_nuvemshop_bulk_sync")

        # ------------------------------------------------------------------
        # 3. FILAS DE E-COMMERCE & SCRAPING
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

        ecommerce_processed_queue = await channel.declare_queue(
            "ecommerce_processed_queue",
            durable=True,
            arguments={
                "x-dead-letter-exchange": "ecommerce_dlx",
                "x-dead-letter-routing-key": "ecommerce_failed",
                "x-max-length": 10000
            }
        )

        # ------------------------------------------------------------------
        # 4. FILAS FINANCEIRAS & WEBHOOKS
        # ------------------------------------------------------------------
        payments_process_queue = await channel.declare_queue(
            "payments_process_queue",
            durable=True,
            arguments={
                "x-dead-letter-exchange": "mercadopago_dlx",
                "x-dead-letter-routing-key": "mp_failed",
                "x-max-length": 10000
            }
        )

        # ------------------------------------------------------------------
        # 5. FILAS LLM & TELEMETRIA ASSÍNCRONA
        # ------------------------------------------------------------------
        llm = await channel.declare_queue(
            "llm", 
            durable=True,
            arguments={
                "x-dead-letter-exchange": "llm_dlx",
                "x-dead-letter-routing-key": "llm_failed",
                "x-max-length": 10000
            }
        )

        llm_usage_queue = await channel.declare_queue(
            "llm_usage_queue",
            durable=True,
            arguments={
                "x-dead-letter-exchange": "llm_dlx",
                "x-dead-letter-routing-key": "llm_failed",
                "x-max-length": 10000
            }
        )

        # ------------------------------------------------------------------
        # 6. FILAS DE MACHINE LEARNING & ANALYTICS
        # ------------------------------------------------------------------
        analytics_ml_queue = await channel.declare_queue(
            "analytics_ml_queue",
            durable=True,
            arguments={
                "x-dead-letter-exchange": "ecommerce_dlx",
                "x-dead-letter-routing-key": "ecommerce_failed",
                "x-max-length": 1000
            }
        )

        analytics_processed_queue = await channel.declare_queue(
            "analytics_processed_queue",
            durable=True,
            arguments={
                "x-dead-letter-exchange": "ecommerce_dlx",
                "x-dead-letter-routing-key": "ecommerce_failed",
                "x-max-length": 1000
            }
        )

        # ------------------------------------------------------------------
        # 7. FILAS DE NOTIFICAÇÕES & INTEGRAÇÕES
        # ------------------------------------------------------------------
        email_notifications = await channel.declare_queue(
            "email_notifications",
            durable=True,
            arguments={
                "x-dead-letter-exchange": "ecommerce_dlx",
                "x-dead-letter-routing-key": "email_failed",
                "x-max-length": 10000
            }
        )

        shopify_webhook = await channel.declare_queue(
            "shopify_webhook",
            durable=True,
            arguments={
                "x-dead-letter-exchange": "shopify_dlx",
                "x-dead-letter-routing-key": "shopify_failed",
                "x-max-length": 10000
            }
        )

        nuvemshop_bulk_sync = await channel.declare_queue(
            "nuvemshop_bulk_sync",
            durable=True,
            arguments={
                "x-dead-letter-exchange": "nuvemshop_dlx",
                "x-dead-letter-routing-key": "dlq_nuvemshop_bulk_sync",
                "x-max-length": 10000
            }
        )

        logger.info("Topologia RabbitMQ (Exchanges, DLQs com TTL 7d e Filas Principais) configurada com sucesso.")

        return {
            "demo_ecommerce": demo_ecommerce,
            "ecommerce": ecommerce,
            "ecommerce_processed_queue": ecommerce_processed_queue,
            "payments_process_queue": payments_process_queue,
            "llm": llm,
            "llm_usage_queue": llm_usage_queue,
            "analytics_ml_queue": analytics_ml_queue,
            "analytics_processed_queue": analytics_processed_queue,
            "email_notifications": email_notifications,
            "shopify_webhook": shopify_webhook,
            "nuvemshop_bulk_sync": nuvemshop_bulk_sync,
            "dlq_ecommerce": dlq_ecommerce,
            "dlq_mercado_pago": dlq_mercado_pago,
            "dlq_llm": dlq_llm,
            "dlq_shopify": dlq_shopify,
            "dlq_nuvemshop": dlq_nuvemshop,
            "dlq_nuvemshop_bulk_sync": dlq_nuvemshop_bulk_sync,
        }

    except Exception as e:
        logger.error(f"Erro ao configurar topologia do RabbitMQ: {e}")
        raise