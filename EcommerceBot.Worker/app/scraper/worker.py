import asyncio
import json
import logging
import aio_pika
from .parser import ScraperAndLLMParser
from app.core.config.settings import settings
from app.core.config.rabbitmq import (
    QUEUE_ECOMMERCE,
    QUEUE_ECOMMERCE_PROCESSED,
    QUEUE_LLM_USAGE,
    ECOMMERCE_QUEUE_ARGS
)

logger = logging.getLogger(__name__)

QUEUE_INPUT = QUEUE_ECOMMERCE
QUEUE_OUTPUT = QUEUE_ECOMMERCE_PROCESSED

async def _process_single_message(message: aio_pika.IncomingMessage, channel: aio_pika.Channel, parser: ScraperAndLLMParser):
    async with message.process():
        body_text = message.body.decode("utf-8")
        try:
            payload = json.loads(body_text)
        except Exception as e:
            logger.error(f"Erro ao decodificar JSON da mensagem: {e}. Corpo: {body_text}")
            return

        tenant_id = payload.get("tenantId") or payload.get("TenantId")
        sku = payload.get("sku") or payload.get("Sku")
        url = payload.get("url") or payload.get("Url") or payload.get("targetUrl") or payload.get("TargetUrl")
        prompt_ctx = payload.get("promptContext") or payload.get("PromptContext")

        if not url or not tenant_id or not sku:
            logger.warning(f"Payload inválido ou incompleto: {payload}")
            return

        logger.info(f"🕷️ [ScraperWorker] Processando Scraping com Scrapling para Tenant {tenant_id} | SKU {sku} | URL {url}")

        try:
            result = await parser.parse_and_enrich(url, prompt_context=prompt_ctx)

            response_event = {
                "tenantId": tenant_id,
                "sku": sku,
                "title": result.get("title", ""),
                "description": result.get("description", ""),
                "status": "PROCESSED",
                "errorMessage": "",
                "aiMetadataJson": json.dumps({
                    "model_used": result.get("model_used", "scrapling/adaptive-dom"),
                    "price": result.get("price"),
                    "brand": result.get("brand"),
                    "category": result.get("category"),
                    "images": result.get("images", [])
                })
            }
            logger.info(f"✅ Scraping bem-sucedido para SKU {sku}. Publicando no {QUEUE_OUTPUT}")

            # Publica evento assíncrono de telemetria de LLM em llm_usage_queue
            usage_event = {
                "tenantId": tenant_id,
                "productId": sku,
                "provider": "openrouter",
                "modelUsed": result.get("model_used", "deepseek/deepseek-chat"),
                "promptTokens": result.get("prompt_tokens", 350),
                "completionTokens": result.get("completion_tokens", 250),
                "totalTokens": result.get("total_tokens", 600),
                "estimatedCostUsd": 0.00015,
                "isByok": False,
                "executionTimeMs": result.get("duration_ms", 1200)
            }
            await channel.default_exchange.publish(
                aio_pika.Message(
                    body=json.dumps(usage_event).encode("utf-8"),
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT
                ),
                routing_key=QUEUE_LLM_USAGE
            )

        except Exception as ex:
            logger.error(f"❌ Falha no Scraping para SKU {sku} ({url}): {ex}", exc_info=True)
            response_event = {
                "tenantId": tenant_id,
                "sku": sku,
                "title": "",
                "description": "",
                "status": "FAILED",
                "errorMessage": str(ex),
                "aiMetadataJson": "{}"
            }

        # Publica o resultado no RabbitMQ
        try:
            await channel.default_exchange.publish(
                aio_pika.Message(
                    body=json.dumps(response_event).encode("utf-8"),
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT
                ),
                routing_key=QUEUE_OUTPUT
            )
        except Exception as pub_err:
            logger.error(f"Erro ao publicar no RabbitMQ ({QUEUE_OUTPUT}): {pub_err}")


async def start_scraper_worker():
    """
    Worker resiliente com reconexão automática ao RabbitMQ e DLQs configuradas.
    """
    logger.info(f"📡 Inicializando ScraperWorker conectado a {settings.RABBITMQ_URL}...")
    parser = ScraperAndLLMParser()

    while True:
        try:
            connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
            async with connection:
                channel = await connection.channel()
                await channel.set_qos(prefetch_count=5)

                # Declaração das filas com os mesmos argumentos canônicos da topologia
                queue = await channel.declare_queue(QUEUE_INPUT, durable=True, arguments=ECOMMERCE_QUEUE_ARGS)
                await channel.declare_queue(QUEUE_OUTPUT, durable=True)
                await channel.declare_queue(QUEUE_LLM_USAGE, durable=True)

                logger.info(f"🚀 ScraperWorker pronto e escutando na fila '{QUEUE_INPUT}'...")

                async for message in queue:
                    await _process_single_message(message, channel, parser)

        except asyncio.CancelledError:
            logger.info("🛑 ScraperWorker cancelado.")
            break
        except Exception as e:
            logger.warning(f"⚠️ Conexão RabbitMQ perdida no ScraperWorker ({e}). Reconectando em 5 segundos...")
            await asyncio.sleep(5)
