import json
import time
import asyncio
import logging
from typing import Optional, Tuple
from datetime import datetime, timezone, timedelta
import aio_pika
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import AsyncSessionLocal
from app.core.config.rabbitmq import get_rabbitmq_connection
from app.features.products.domain.models import ProductModel
from app.features.ai_enrichment.domain.exceptions import (
    AllProvidersExhaustedError,
    InsufficientCreditsException,
)
from app.features.ai_enrichment.services import LLMService, LLMMeteringService
from app.features.ai_enrichment.schemas import LLMUsageLogCreate
from app.features.system.repositories import TelemetryRepository
from app.core.shared.logger import get_logger
from app.core.security.crypto import get_tenant_key
from app.features.products.schemas import Product, ProductStatus
from app.core.shared.progress import publish_demo_progress

logger = get_logger("ProcessorWorker")

def _log_retry(retry_state):
    logger.warning(f"Retentando processamento LLM... Tentativa {retry_state.attempt_number}")

class ProcessorWorker:
    def __init__(self, repo, llm, session: Optional[AsyncSession] = None):
        self.repo = repo
        self.llm = llm
        self.session = session

    async def _get_session(self) -> Tuple[AsyncSession, bool]:
        if self.session is not None:
            return self.session, False
        return AsyncSessionLocal(), True

    async def reset_stuck_processing_jobs(self, timeout_minutes: int = 10) -> int:
        """
        Resgata e reseta produtos travados no estado 'Processing' há mais de timeout_minutes minutos,
        retornando-os para o estado 'Raw' para permitirem re-processamento.
        """
        session, should_close = await self._get_session()
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(minutes=timeout_minutes)
            stmt = (
                update(ProductModel)
                .where(
                    ProductModel.status == ProductStatus.PROCESSING.value,
                    ProductModel.updated_at <= cutoff,
                )
                .values(
                    status=ProductStatus.RAW.value,
                    updated_at=datetime.now(timezone.utc),
                )
            )
            result = await session.execute(stmt)
            await session.commit()
            count = result.rowcount
            if count > 0:
                logger.info(f"🔄 Resetados {count} produtos travados em 'Processing' de volta para 'Raw'.")
            return count
        except Exception as err:
            logger.error(f"Erro ao resetar produtos travados em Processing: {err}")
            await session.rollback()
            return 0
        finally:
            if should_close:
                await session.close()

    @retry(
        wait=wait_exponential(multiplier=1, min=4, max=60),
        stop=stop_after_attempt(5),
        retry=retry_if_exception_type(AllProvidersExhaustedError),
        before_sleep=_log_retry
    )
    async def _process_with_retry(self, product, current_llm=None):
        llm_to_use = current_llm or self.llm
        return await llm_to_use.enrich_product(product)

    async def start_consuming(self, queue_name: str, channel: aio_pika.abc.AbstractChannel = None):
        """
        Substitui o antigo loop de polling no banco de dados. 
        Agora o worker é acionado 100% por mensageria via RabbitMQ.
        """
        try:
            await self.reset_stuck_processing_jobs(timeout_minutes=10)
            if channel is None:
                connection = await get_rabbitmq_connection()
                channel = await connection.channel()

            # QOS maior permite processar mais itens em paralelo, já que LLM tem alto tempo de I/O de rede
            await channel.set_qos(prefetch_count=2)
            queue = await channel.get_queue(queue_name)

            logger.info(f"ProcessorWorker aguardando tarefas de LLM na fila '{queue_name}'...")

            async with queue.iterator() as queue_iter:
                async for message in queue_iter:
                    async with message.process(requeue=False, ignore_processed=True):
                        try:
                            payload = json.loads(message.body.decode())
                            tenant_id = payload.get("tenant_id")
                            sku = payload.get("sku")

                            if not tenant_id or not sku:
                                raise ValueError("Payload inválido. Necessário 'tenant_id' e 'sku'.")

                            await self._process_llm_task(tenant_id, sku, queue_name)

                        except Exception as process_err:
                            logger.error(f"Erro ao processar LLM na fila {queue_name}: {process_err}")
                            # Joga a mensagem para a DLQ (Dead Letter Queue) do ecommerce
                            raise

        except Exception as e:
            logger.error(f"Erro assíncrono na conexão/consumo do RabbitMQ no ProcessorWorker: {e}")

    async def _process_llm_task(self, tenant_id: str, sku: str, queue_name: str):
        log_extra = {"sku": sku}
        logger.info(f"Iniciando Enriquecimento LLM - SKU: {sku} | Tenant: {tenant_id}", extra=log_extra)

        session, should_close = await self._get_session()
        product_id = None
        try:
            # Busca estritamente o produto designado pela mensagem do RabbitMQ
            stmt = select(ProductModel).where(
                ProductModel.tenant_id == tenant_id,
                ProductModel.sku == sku,
                ProductModel.status == ProductStatus.RAW.value
            )
            result = await session.execute(stmt)
            row = result.scalar_one_or_none()

            if not row:
                logger.warning(f"SKU {sku} não encontrado em estado RAW ou pertence a outro tenant. Ignorando.", extra=log_extra)
                return

            product_id = row.id

            # Lock Otimista: Marca como PROCESSING para evitar que outro worker pegue (caso haja retries/requeues)
            row.status = ProductStatus.PROCESSING.value
            row.updated_at = datetime.now(timezone.utc)
            await session.commit()
            
            product_dict = dict(row.raw_payload or {})
        finally:
            if should_close:
                await session.close()

        start_time = time.time()
        try:
            product_model = Product(**product_dict)
            is_demo = tenant_id == "demo_tenant"

            if is_demo:
                source_url = product_dict.get("metadata", {}).get("source_url", "") if isinstance(product_dict.get("metadata"), dict) else ""
                await publish_demo_progress(
                    url=source_url,
                    status="processing",
                    progress=50
                )

            # Instanciação via Factory assíncrona com suporte a BYOK e Settings
            current_llm = await LLMService.create_for_tenant(
                tenant_id=tenant_id, is_demo=is_demo, session=session
            )

            # Validação de BYOK e Créditos antes do disparo da requisição de IA
            metering_service = LLMMeteringService(db=session)
            is_byok_active = False
            llm_router = None
            try:
                llm_router = getattr(current_llm, "llm_router", None)
            except AttributeError:
                llm_router = None

            if llm_router:
                try:
                    tenant_key = await llm_router._resolve_tenant_key(tenant_id, session)
                    if tenant_key:
                        is_byok_active = True
                except Exception:
                    is_byok_active = False

            try:
                await metering_service.check_tenant_credits(tenant_id=tenant_id, is_byok=is_byok_active)
            except InsufficientCreditsException as credit_err:

                logger.warning(
                    f"[ProcessorWorker] Saldo de créditos insuficiente para tenant '{tenant_id}' (SKU: {sku}). Produto marcado como FAILED.",
                    extra=log_extra,
                )
                await self.repo.set_status(tenant_id, sku, ProductStatus.FAILED.value)
                if is_demo:
                    source_url = product_dict.get("metadata", {}).get("source_url", "") if isinstance(product_dict.get("metadata"), dict) else ""
                    await publish_demo_progress(
                        url=source_url,
                        status="failed",
                        progress=100,
                        error="Saldo de créditos insuficiente para processar a requisição de IA. Ative o modo BYOK ou recarregue seu saldo."
                    )
                return

            # Aciona o enriquecimento via LLMEngineRouter com política de Retry
            processed_data = await self._process_with_retry(product_model, current_llm)

            # Extrai metadados do enriquecimento (model_used, tokens, tempo de resposta)
            attrs = processed_data.attributes or {}
            raw_meta = attrs.get("enrichment_metadata") or getattr(processed_data, "ai_enriched_data", {}) or {}
            if isinstance(raw_meta, str):
                try:
                    enrichment_metadata = json.loads(raw_meta)
                except Exception:
                    enrichment_metadata = {}
            elif isinstance(raw_meta, dict):
                enrichment_metadata = raw_meta
            else:
                enrichment_metadata = {}

            model_used = enrichment_metadata.get("model_used", "OpenRouter")
            prompt_tokens = enrichment_metadata.get("prompt_tokens", 0)
            completion_tokens = enrichment_metadata.get("completion_tokens", 0)
            response_time_ms = enrichment_metadata.get("response_time_ms", round((time.time() - start_time) * 1000, 2))

            processed_data.status = ProductStatus.PROCESSED
            processed_data.updated_at = datetime.now(timezone.utc)
            await self.repo.upsert_product(processed_data)

            duration_ms = int((time.time() - start_time) * 1000)

            # Grava o log de uso de LLM e decrementa o saldo de créditos do tenant se modo Gerenciado
            try:
                usage_dto = LLMUsageLogCreate(
                    tenant_id=tenant_id,
                    product_id=product_id,
                    provider="openrouter",
                    model_used=model_used,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=prompt_tokens + completion_tokens,
                    is_byok=is_byok_active,
                    execution_time_ms=int(response_time_ms) if response_time_ms else duration_ms,
                )
                await metering_service.record_usage_and_deduct(tenant_id=tenant_id, usage_dto=usage_dto)
            except Exception as metering_err:
                logger.warning(f"Erro ao registrar consumo e débito no LLMMeteringService: {metering_err}")

            # Grava telemetria de atividade e uso real de tokens do OpenRouter
            try:
                telemetry_repo = TelemetryRepository(session=self.session)
                await telemetry_repo.log_activity(
                    tenant_id=tenant_id,
                    worker_type="processor",
                    status="SUCCESS",
                    details={"sku": sku, "model": model_used},
                    duration_ms=duration_ms
                )
                await telemetry_repo.record_token_usage(
                    tenant_id=tenant_id,
                    provider="openrouter",
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens
                )
            except Exception as telemetry_err:
                logger.warning(f"Erro ao registrar telemetria do ProcessorWorker: {telemetry_err}")

            logger.info(
                f"[ProcessorWorker] Produto {sku} enriquecido com sucesso via {model_used} em {response_time_ms}ms",
                extra=log_extra
            )


            if is_demo:
                await self._publish_demo_success(product_dict, processed_data)

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            try:
                telemetry_repo = TelemetryRepository(session=self.session)
                await telemetry_repo.log_activity(
                    tenant_id=tenant_id,
                    worker_type="processor",
                    status="FAILED",
                    details={"sku": sku, "error": str(e)},
                    duration_ms=duration_ms
                )
            except Exception as telemetry_err:
                logger.warning(f"Erro ao registrar falha de telemetria do ProcessorWorker: {telemetry_err}")

            logger.error(f"Falha final nas LLMs para produto {sku}: {e}", extra=log_extra, exc_info=True)
            await self.repo.set_status(tenant_id, sku, ProductStatus.FAILED.value)
            
            if is_demo:
                source_url = product_dict.get("metadata", {}).get("source_url", "") if isinstance(product_dict.get("metadata"), dict) else ""
                await publish_demo_progress(
                    url=source_url,
                    status="failed",
                    progress=100,
                    error=f"Erro no processamento da IA: {str(e)}"
                )
            raise # Interrompe a execução para a mensagem cair na DLX (ecommerce_failed)

    async def _publish_demo_success(self, raw_dict: dict, processed_data: Product):
        original_data = {
            "title": raw_dict.get("title", ""),
            "description": raw_dict.get("description", ""),
            "price": str(raw_dict.get("price")) if raw_dict.get("price") is not None else None,
            "imageUrl": raw_dict.get("images")[0] if raw_dict.get("images") else None
        }
        seo_tags = processed_data.attributes.get("seo_tags", "") if processed_data.attributes else ""
        enhanced_data = {
            "seoTitle": processed_data.title,
            "copywriting": processed_data.description,
            "tags": seo_tags.split(",") if seo_tags else []
        }
        await publish_demo_progress(
            url=processed_data.metadata.source_url if processed_data.metadata else "",
            status="completed",
            progress=100,
            original=original_data,
            enhanced=enhanced_data
        )