import asyncio
import hashlib
import json
import aio_pika
from pydantic import ValidationError
from .parser import ScraperAndLLMParser
from .schemas import ScrapingRequest, ProductEnrichmentMetadata, ProductProcessedEvent, LlmUsageEvent
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
            req = ScrapingRequest.model_validate_json(body_text)
        except ValidationError as val_err:
            logger.warning(
                f"Payload com erro de validação Pydantic no ScraperWorker: {val_err}",
                extra={"body": body_text, "errors": val_err.errors()}
            )
            # Tenta recuperar tenant_id e sku para notificar o C# (estorno de créditos no Ledger e encerramento de SSE)
            try:
                raw_payload = json.loads(body_text)
                raw_tenant = raw_payload.get("tenantId") or raw_payload.get("TenantId") or raw_payload.get("tenant_id")
                raw_sku = raw_payload.get("sku") or raw_payload.get("Sku") or raw_payload.get("productId") or raw_payload.get("ProductId") or "unknown"
                if raw_tenant:
                    failed_event = ProductProcessedEvent(
                        tenant_id=raw_tenant,
                        sku=str(raw_sku),
                        title="",
                        description="",
                        status="FAILED",
                        is_fallback=True,
                        error_message=f"Payload inválido ou incompleto recebido no ScraperWorker: {val_err.error_count()} erro(s) de validação.",
                        ai_metadata_json="{}"
                    )
                    await channel.default_exchange.publish(
                        aio_pika.Message(
                            body=failed_event.model_dump_json(by_alias=True).encode("utf-8"),
                            content_type="application/json",
                            delivery_mode=aio_pika.DeliveryMode.PERSISTENT
                        ),
                        routing_key=QUEUE_OUTPUT
                    )
            except Exception as notify_err:
                logger.error(f"Falha ao emitir evento de falha de validação para {QUEUE_OUTPUT}: {notify_err}")
            return
        except Exception as json_err:
            logger.error(f"Erro ao decodificar JSON da mensagem: {json_err}. Corpo: {body_text}")
            return

        tenant_id = req.tenant_id
        sku = req.sku
        url = req.url
        prompt_ctx = req.prompt_context
        is_byok = req.is_byok

        # 1. Verificação de Idempotência no Redis (TTL 24h) baseada no hash SHA-256 da URL canônica
        canonical_url = str(url).strip().lower()
        url_hash = hashlib.sha256(canonical_url.encode("utf-8")).hexdigest()
        idempotency_key = f"worker:idempotency:scraper:{tenant_id}:{url_hash}"
        if await redis_cache.is_already_processed(idempotency_key):
            logger.info(
                "Mensagem já processada anteriormente para esta URL (idempotência ativa). Ignorando reexecução redundante.",
                extra={"tenant_id": str(tenant_id), "sku": str(sku), "url_hash": url_hash}
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
            failed_event = ProductProcessedEvent(
                tenant_id=tenant_id,
                sku=sku,
                title="",
                description="",
                status="FAILED",
                is_fallback=True,
                error_message=f"Bloqueio de rede / Anti-SSRF: {ssrf_err}",
                ai_metadata_json="{}"
            )
            try:
                await channel.default_exchange.publish(
                    aio_pika.Message(
                        body=failed_event.model_dump_json(by_alias=True).encode("utf-8"),
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

            raw_images = result.get("images", [])
            images_list = raw_images if isinstance(raw_images, list) else []

            enrichment_metadata = ProductEnrichmentMetadata(
                price=result.get("price"),
                brand=result.get("brand"),
                category=result.get("category"),
                model_used=result.get("model_used", "scrapling/adaptive-dom"),
                images=images_list
            )

            response_event = ProductProcessedEvent(
                tenant_id=tenant_id,
                sku=sku,
                title=result.get("title", ""),
                description=result.get("description", ""),
                status="PROCESSED",
                is_fallback=False,
                error_message="",
                ai_metadata_json=enrichment_metadata.model_dump_json(by_alias=True)
            )
            logger.info(f"Scraping bem-sucedido para SKU {sku}. Publicando no {QUEUE_OUTPUT}")

            # Publica evento assíncrono de telemetria de LLM em llm_usage_queue
            usage_event = LlmUsageEvent(
                tenant_id=tenant_id,
                product_id=sku,
                provider="openrouter",
                model_used=result.get("model_used", "deepseek/deepseek-chat"),
                prompt_tokens=result.get("prompt_tokens", 350),
                completion_tokens=result.get("completion_tokens", 250),
                total_tokens=result.get("total_tokens", 600),
                estimated_cost_usd=0.0 if is_byok else 0.00015,
                is_byok=is_byok,
                execution_time_ms=result.get("duration_ms", 1200)
            )
            await channel.default_exchange.publish(
                aio_pika.Message(
                    body=usage_event.model_dump_json(by_alias=True).encode("utf-8"),
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT
                ),
                routing_key=QUEUE_LLM_USAGE
            )

            # 3. Registra chave de idempotência com TTL de 24h
            await redis_cache.set_idempotency_key(idempotency_key, ttl_seconds=86400)

        except Exception as ex:
            logger.error(f"Falha no Scraping para SKU {sku} ({url}): {ex}", exc_info=True)
            response_event = ProductProcessedEvent(
                tenant_id=tenant_id,
                sku=sku,
                title="",
                description="",
                status="FAILED",
                is_fallback=True,
                error_message=str(ex),
                ai_metadata_json="{}"
            )

        # Publica o resultado no RabbitMQ
        try:
            await channel.default_exchange.publish(
                aio_pika.Message(
                    body=response_event.model_dump_json(by_alias=True).encode("utf-8"),
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
