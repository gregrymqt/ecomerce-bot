import json
import asyncio
import logging
from typing import Optional, Tuple
from datetime import datetime, timezone
import aio_pika
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import AsyncSessionLocal
from app.core.config.rabbitmq import get_rabbitmq_connection
from app.features.products.domain.models import ProductModel
from app.features.ai_enrichment.domain.exceptions import AllProvidersExhaustedError
from app.features.ai_enrichment.services import LLMService
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

            # Lock Otimista: Marca como PROCESSING para evitar que outro worker pegue (caso haja retries/requeues)
            row.status = ProductStatus.PROCESSING.value
            row.updated_at = datetime.now(timezone.utc)
            await session.commit()
            
            product_dict = dict(row.raw_payload or {})
        finally:
            if should_close:
                await session.close()

        try:
            product_model = Product(**product_dict)
            is_demo = tenant_id == "demo_tenant"
            current_llm = self.llm

            # Avaliação de chaves criptografadas (BYOK)
            if tenant_id and not is_demo:
                tenant_deepseek_key = await get_tenant_key(tenant_id, "deepseek")
                tenant_groq_key = await get_tenant_key(tenant_id, "groq")
                
                if tenant_deepseek_key or tenant_groq_key:
                    logger.info(f"Usando BYOK (Chave do Cliente) para o tenant: {tenant_id}")
                    current_llm = LLMService(
                        deepseek_api_key=tenant_deepseek_key,
                        groq_api_key=tenant_groq_key,
                        is_demo=False
                    )
            elif is_demo:
                current_llm = LLMService(is_demo=True)

            # Aciona as LLMs com política de Retry Backoff Exponencial
            processed_data = await self._process_with_retry(product_model, current_llm)

            processed_data.status = ProductStatus.PROCESSED
            processed_data.updated_at = datetime.now(timezone.utc)
            await self.repo.upsert_product(processed_data)

            if is_demo:
                await self._publish_demo_success(product_dict, processed_data)

        except Exception as e:
            logger.error(f"Falha final nas LLMs para produto {sku}: {e}", extra=log_extra, exc_info=True)
            await self.repo.set_status(tenant_id, sku, ProductStatus.FAILED.value)
            
            if is_demo:
                await publish_demo_progress(
                    url=product_dict.get("metadata", {}).get("source_url", ""),
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