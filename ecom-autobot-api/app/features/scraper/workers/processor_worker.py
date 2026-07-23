import asyncio
import logging
from datetime import datetime, timezone, timedelta
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
from sqlalchemy import select, update

from app.core.config.database import AsyncSessionLocal
from app.features.products.models import ProductModel
from app.features.ai_enrichment.service import AllProvidersExhaustedError, LLMService
from app.core.shared.logger import get_logger
from app.core.security.crypto import get_tenant_key
from app.features.products.schemas import Product, ProductStatus
from app.core.shared.progress import publish_demo_progress

logger = get_logger("ProcessorWorker")

def _log_retry(retry_state):
    logger.warning(f"Retentando processamento LLM... Tentativa {retry_state.attempt_number}")

class ProcessorWorker:
    def __init__(self, repo, llm):
        self.repo = repo
        self.llm = llm
        self.last_cleanup = datetime.now(timezone.utc)

    @retry(
        wait=wait_exponential(multiplier=1, min=4, max=60),
        stop=stop_after_attempt(5),
        retry=retry_if_exception_type(AllProvidersExhaustedError),
        before_sleep=_log_retry
    )
    async def _process_with_retry(self, product, current_llm=None):
        llm_to_use = current_llm or self.llm
        return await llm_to_use.enrich_product(product)

    async def run(self):
        logger.info("ProcessorWorker iniciado. Monitorando novos produtos...")
        while True:
            async with AsyncSessionLocal() as session:
                current_time = datetime.now(timezone.utc)
                if current_time - self.last_cleanup > timedelta(minutes=5):
                    ten_minutes_ago = current_time - timedelta(minutes=10)
                    cleanup = (
                        update(ProductModel)
                        .where(
                            ProductModel.status == ProductStatus.PROCESSING.value,
                            ProductModel.updated_at < ten_minutes_ago,
                        )
                        .values(status=ProductStatus.RAW.value)
                    )
                    await session.execute(cleanup)
                    await session.commit()
                    self.last_cleanup = current_time

                stmt = (
                    select(ProductModel)
                    .where(ProductModel.status == ProductStatus.RAW.value)
                    .order_by(ProductModel.created_at)
                    .limit(1)
                )
                result = await session.execute(stmt)
                row = result.scalar_one_or_none()

                if row is None:
                    await asyncio.sleep(10)
                    continue

                row.status = ProductStatus.PROCESSING.value
                row.updated_at = datetime.now(timezone.utc)
                await session.commit()
                product_dict = dict(row.raw_payload or {})

            try:
                product_model = Product(**product_dict)
            except Exception as e:
                logger.error(f"Erro de validação no DB para o produto {product_dict.get('sku', 'unknown')}: {e}", exc_info=True)
                await self.repo.set_status(product_dict.get("tenant_id"), product_dict.get("sku"), ProductStatus.FAILED.value)
                continue

            sku = product_model.sku
            log_extra = {"sku": sku}
            try:
                logger.info(f"Iniciando SKU: {sku}", extra=log_extra)

                current_llm = self.llm
                is_demo = product_model.tenant_id == "demo_tenant"
                if product_model.tenant_id:
                    tenant_deepseek_key = await get_tenant_key(product_model.tenant_id, "deepseek")
                    tenant_groq_key = await get_tenant_key(product_model.tenant_id, "groq")
                    if tenant_deepseek_key or tenant_groq_key:
                        logger.info(f"Usando chave de API própria (BYOK) para o tenant: {product_model.tenant_id}")
                        current_llm = LLMService(
                            deepseek_api_key=tenant_deepseek_key,
                            groq_api_key=tenant_groq_key,
                            is_demo=is_demo
                        )
                    elif is_demo:
                        current_llm = LLMService(is_demo=True)
                elif is_demo:
                    current_llm = LLMService(is_demo=True)

                processed_data = await self._process_with_retry(product_model, current_llm)

                processed_data.status = ProductStatus.PROCESSED
                processed_data.updated_at = datetime.now(timezone.utc)
                await self.repo.upsert_product(processed_data)

                if product_model.tenant_id == "demo_tenant":
                    original_data = {
                        "title": product_dict.get("title", ""),
                        "description": product_dict.get("description", ""),
                        "price": str(product_dict.get("price")) if product_dict.get("price") is not None else None,
                        "imageUrl": product_dict.get("images")[0] if product_dict.get("images") else None
                    }
                    seo_tags = processed_data.attributes.get("seo_tags", "") if processed_data.attributes else ""
                    enhanced_data = {
                        "seoTitle": processed_data.title,
                        "copywriting": processed_data.description,
                        "tags": seo_tags.split(",") if seo_tags else []
                    }
                    await publish_demo_progress(
                        url=product_model.metadata.source_url if product_model.metadata else "",
                        status="completed",
                        progress=100,
                        original=original_data,
                        enhanced=enhanced_data
                    )

            except (ValueError, TypeError) as e:
                logger.error(f"Erro de validação de dados no produto {sku}: {e}", extra=log_extra, exc_info=True)
                await self.repo.set_status(product_model.tenant_id, sku, ProductStatus.FAILED.value)
                if product_model.tenant_id == "demo_tenant":
                    await publish_demo_progress(
                        url=product_model.metadata.source_url if product_model.metadata else "",
                        status="failed",
                        progress=100,
                        error=f"Erro de validação: {str(e)}"
                    )
            except Exception as e:
                logger.error(f"Erro final (após retries) ao processar produto {sku}: {e}", extra=log_extra, exc_info=True)
                await self.repo.set_status(product_model.tenant_id, sku, ProductStatus.FAILED.value)
                if product_model.tenant_id == "demo_tenant":
                    await publish_demo_progress(
                        url=product_model.metadata.source_url if product_model.metadata else "",
                        status="failed",
                        progress=100,
                        error=f"Erro no processamento: {str(e)}"
                    )

            await asyncio.sleep(1)
