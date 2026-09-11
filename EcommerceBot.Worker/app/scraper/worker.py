import asyncio
import json
import aio_pika
from .parser import ScraperAndLLMParser
from app.core.config.settings import settings
from app.core.shared.logger import get_logger
from app.core.shared.security import validate_url_safety
from app.core.config.redis_db import redis_cache
from app.core.config.rabbitmq import (
    QUEUE_ECOMMERCE,
    QUEUE_DEMO_ECOMMERCE,
    QUEUE_ECOMMERCE_PROCESSED,
    QUEUE_LLM_USAGE,
    ECOMMERCE_QUEUE_ARGS,
    DEMO_ECOMMERCE_QUEUE_ARGS,
)

logger = get_logger("worker.scraper")

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
        is_byok = bool(payload.get("isByok") or payload.get("IsByok") or False)

        if not url or not tenant_id or not sku:
            logger.warning("Payload inválido ou incompleto recebido no ScraperWorker", extra={"payload": payload})
            return

        # 1. Verificação de Idempotência no Redis (TTL 24h)
        idempotency_key = f"worker:idempotency:scraper:{tenant_id}:{sku}"
        if await redis_cache.is_already_processed(idempotency_key):
            logger.info(
                "Mensagem já processada anteriormente (idempotência ativa). Ignorando reexecução redundante.",
                extra={"tenant_id": str(tenant_id), "sku": str(sku)}
            )
            return

        logger.info(
            f"Processando Scraping com Scrapling para Tenant {tenant_id} | SKU {sku} | URL {url} | BYOK: {is_byok}",
            extra={"tenant_id": str(tenant_id), "sku": str(sku), "url": str(url)}
        )

        # 2. Defesa em Profundidade Anti-SSRF antes do acionamento do scraper
        try:
            validate_url_safety(url)
        except ValueError as ssrf_err:
            logger.warning(
                f"Bloqueio de segurança Anti-SSRF/Rede para URL {url}: {ssrf_err}",
                extra={"tenant_id": str(tenant_id), "sku": str(sku), "reason": str(ssrf_err)}
            )
            failed_event = {
                "tenantId": tenant_id,
                "sku": sku,
                "title": "",
                "description": "",
                "status": "FAILED",
                "isFallback": True,
                "errorMessage": f"Bloqueio de rede / Anti-SSRF: {ssrf_err}",
                "aiMetadataJson": "{}"
            }
            try:
                await channel.default_exchange.publish(
                    aio_pika.Message(
                        body=json.dumps(failed_event).encode("utf-8"),
                        content_type="application/json",
                        delivery_mode=aio_pika.DeliveryMode.PERSISTENT
                    ),
                    routing_key=QUEUE_OUTPUT
                )
            except Exception as pub_err:
                logger.error(f"Erro ao publicar falha de SSRF no RabbitMQ: {pub_err}")
            return

        try:
            result = await parser.parse_and_enrich(url, prompt_context=prompt_ctx)

            response_event = {
                "tenantId": tenant_id,
                "sku": sku,
                "title": result.get("title", ""),
                "description": result.get("description", ""),
                "status": "PROCESSED",
                "isFallback": False,
                "errorMessage": "",
                "aiMetadataJson": json.dumps({
                    "model_used": result.get("model_used", "scrapling/adaptive-dom"),
                    "price": result.get("price"),
                    "brand": result.get("brand"),
                    "category": result.get("category"),
                    "images": result.get("images", [])
                })
            }
            logger.info(f"Scraping bem-sucedido para SKU {sku}. Publicando no {QUEUE_OUTPUT}")

            # Publica evento assíncrono de telemetria de LLM em llm_usage_queue
            usage_event = {
                "tenantId": tenant_id,
                "productId": sku,
                "provider": "openrouter",
                "modelUsed": result.get("model_used", "deepseek/deepseek-chat"),
                "promptTokens": result.get("prompt_tokens", 350),
                "completionTokens": result.get("completion_tokens", 250),
                "totalTokens": result.get("total_tokens", 600),
                "estimatedCostUsd": 0.0 if is_byok else 0.00015,
                "isByok": is_byok,
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

            # 3. Registra chave de idempotência com TTL de 24h
            await redis_cache.set_idempotency_key(idempotency_key, ttl_seconds=86400)

        except Exception as ex:
            logger.error(f"Falha no Scraping para SKU {sku} ({url}): {ex}", exc_info=True)
            response_event = {
                "tenantId": tenant_id,
                "sku": sku,
                "title": "",
                "description": "",
                "status": "FAILED",
                "isFallback": True,
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
    Escuta concorrentemente as filas QUEUE_ECOMMERCE e QUEUE_DEMO_ECOMMERCE.
    """
    logger.info(f"Inicializando ScraperWorker conectado a {settings.RABBITMQ_URL}...")
    parser = ScraperAndLLMParser()

    while True:
        try:
            connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
            async with connection:
                channel = await connection.channel()
                await channel.set_qos(prefetch_count=5)

                # Declaração das filas de entrada com argumentos canônicos
                queue_prod = await channel.declare_queue(QUEUE_ECOMMERCE, durable=True, arguments=ECOMMERCE_QUEUE_ARGS)
                queue_demo = await channel.declare_queue(QUEUE_DEMO_ECOMMERCE, durable=True, arguments=DEMO_ECOMMERCE_QUEUE_ARGS)
                await channel.declare_queue(QUEUE_OUTPUT, durable=True)
                await channel.declare_queue(QUEUE_LLM_USAGE, durable=True)

                logger.info(f"ScraperWorker pronto e escutando nas filas '{QUEUE_ECOMMERCE}' e '{QUEUE_DEMO_ECOMMERCE}'...")

                async def consume_queue(q: aio_pika.Queue, name: str):
                    logger.info(f"Escuta iniciada na fila: {name}")
                    async for msg in q:
                        await _process_single_message(msg, channel, parser)

                await asyncio.gather(
                    consume_queue(queue_prod, QUEUE_ECOMMERCE),
                    consume_queue(queue_demo, QUEUE_DEMO_ECOMMERCE)
                )

        except asyncio.CancelledError:
            logger.info("ScraperWorker cancelado graciosamente.")
            break
        except Exception as e:
            logger.warning(f"Conexão RabbitMQ perdida no ScraperWorker ({e}). Reconectando em 5 segundos...")
            await asyncio.sleep(5)
