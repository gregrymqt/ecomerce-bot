import asyncio
import hashlib
import json
import aio_pika
from pydantic import ValidationError
from .parser import ScraperParser, ScraperAndLLMParser
from .schemas import ScrapingRequest, ScrapedRawProductEvent
from app.core.config.settings import settings
from app.core.shared.logger import get_logger
from app.core.shared.security import validate_url_safety
from app.core.config.redis_db import redis_cache
from app.core.config.rabbitmq import (
    QUEUE_ECOMMERCE,
    QUEUE_DEMO_ECOMMERCE,
    QUEUE_ECOMMERCE_SCRAPED,
    ECOMMERCE_QUEUE_ARGS,
    DEMO_ECOMMERCE_QUEUE_ARGS,
)

logger = get_logger("worker.scraper")

QUEUE_OUTPUT = QUEUE_ECOMMERCE_SCRAPED

async def _process_single_message(message: aio_pika.IncomingMessage, channel: aio_pika.Channel, parser: ScraperParser):
    async with message.process():
        body_text = message.body.decode("utf-8")
        try:
            req = ScrapingRequest.model_validate_json(body_text)
        except ValidationError as val_err:
            logger.warning(
                f"Payload com erro de validação Pydantic no ScraperWorker: {val_err}",
                extra={"body": body_text, "errors": val_err.errors()}
            )
            # Notifica o C# via ScrapedRawProductEvent com Success=False para centralização de estornos e SSE
            try:
                raw_payload = json.loads(body_text)
                raw_tenant = raw_payload.get("tenantId") or raw_payload.get("TenantId") or raw_payload.get("tenant_id")
                raw_sku = raw_payload.get("sku") or raw_payload.get("Sku") or raw_payload.get("productId") or raw_payload.get("ProductId") or "unknown"
                raw_url = raw_payload.get("url") or raw_payload.get("Url") or raw_payload.get("targetUrl") or ""
                if raw_tenant:
                    failed_event = ScrapedRawProductEvent(
                        tenant_id=raw_tenant,
                        sku=str(raw_sku),
                        url=str(raw_url),
                        success=False,
                        error_message=f"Payload inválido ou incompleto recebido no ScraperWorker: {val_err.error_count()} erro(s) de validação."
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
            f"Processando Scraping determinístico para Tenant {tenant_id} | SKU {sku} | URL {url}",
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
            failed_event = ScrapedRawProductEvent(
                tenant_id=tenant_id,
                sku=sku,
                url=str(url),
                prompt_context=prompt_ctx,
                success=False,
                error_message=f"Bloqueio de rede / Anti-SSRF: {ssrf_err}"
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

            meta_attrs = result.get("meta_attributes", {})
            if not isinstance(meta_attrs, dict):
                meta_attrs = {}

            response_event = ScrapedRawProductEvent(
                tenant_id=tenant_id,
                sku=sku,
                url=url,
                raw_title=result.get("raw_title") or result.get("title", ""),
                raw_description_html=result.get("raw_description_html", ""),
                raw_markdown=result.get("raw_markdown") or result.get("description", ""),
                price=result.get("price"),
                currency=result.get("currency", "BRL"),
                images=images_list,
                meta_attributes={str(k): str(v) for k, v in meta_attrs.items()},
                prompt_context=prompt_ctx,
                success=True,
                error_message=None
            )
            logger.info(f"Scraping concluído para SKU {sku}. Publicando dados brutos em {QUEUE_OUTPUT}")

            # 3. Registra chave de idempotência com TTL de 24h
            await redis_cache.set_idempotency_key(idempotency_key, ttl_seconds=86400)

        except Exception as ex:
            logger.error(f"Falha no Scraping perimetral para SKU {sku} ({url}): {ex}", exc_info=True)
            response_event = ScrapedRawProductEvent(
                tenant_id=tenant_id,
                sku=sku,
                url=url,
                prompt_context=prompt_ctx,
                success=False,
                error_message=str(ex)
            )

        # Publica o resultado (sucesso ou falha) na fila de scraping intermediária
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
    Publica os dados raspados em QUEUE_ECOMMERCE_SCRAPED para orquestração no C#.
    """
    logger.info(f"Inicializando ScraperWorker conectado a {settings.RABBITMQ_URL}...")
    parser = ScraperParser()

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
