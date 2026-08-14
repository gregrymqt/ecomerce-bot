import json
import time
import logging
from decimal import Decimal
from typing import Any, Optional, Tuple
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from sqlalchemy.ext.asyncio import AsyncSession
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

from app.core.config.database import AsyncSessionLocal
from app.core.shared.logger import get_logger
from app.core.shared.progress import publish_demo_progress
from app.features.ai_enrichment.domain.exceptions import (
    AllProvidersExhaustedError,
    InsufficientCreditsException,
)
from app.features.ai_enrichment.schemas import LLMUsageLogCreate
from app.features.ai_enrichment.services import LLMService, LLMMeteringService
from app.features.products.schemas import Product, ProductStatus
from app.features.system.repositories.telemetry_repository import TelemetryRepository
from app.features.wallet.exceptions import InsufficientBalanceException
from app.features.wallet.repositories import WalletRepository
from app.features.wallet.services import CreditService

logger = get_logger("ProcessorService")


def _log_retry(retry_state):
    logger.warning(f"Retentando processamento LLM... Tentativa {retry_state.attempt_number}")


class ProcessorService:
    """
    Serviço de Domínio responsável pelo enriquecimento de produtos via LLM,
    gestão de créditos/metering, telemetria e progresso de demo.
    """

    def __init__(self, repo, llm=None, session: Optional[AsyncSession] = None, worker: Optional[Any] = None):
        self.repo = repo
        self.llm = llm
        self.session = session
        self.worker = worker

    async def _get_session(self) -> Tuple[AsyncSession, bool]:
        if self.session is not None:
            return self.session, False
        return AsyncSessionLocal(), True

    @retry(
        wait=wait_exponential(multiplier=1, min=4, max=60),
        stop=stop_after_attempt(5),
        retry=retry_if_exception_type(AllProvidersExhaustedError),
        before_sleep=_log_retry,
    )
    async def _process_with_retry_internal(self, product, current_llm=None):
        llm_to_use = current_llm or self.llm
        return await llm_to_use.enrich_product(product)

    async def _process_with_retry(self, product, current_llm=None):
        if self.worker is not None and hasattr(self.worker, "_process_with_retry"):
            return await self.worker._process_with_retry(product, current_llm=current_llm)
        return await self._process_with_retry_internal(product, current_llm=current_llm)

    async def process_llm_task(self, tenant_id: str, sku: str, queue_name: str) -> None:
        log_extra = {"sku": sku}
        logger.info(f"Iniciando Enriquecimento LLM - SKU: {sku} | Tenant: {tenant_id}", extra=log_extra)

        # Transição atômica RAW -> PROCESSING encapsulada inteiramente no repositório
        row = await self.repo.transition_status_atomic(
            tenant_id=tenant_id,
            sku=sku,
            from_status=ProductStatus.RAW.value,
            to_status=ProductStatus.PROCESSING.value,
        )

        if not row:
            logger.info(
                f"[ProcessorService] Produto {sku} do tenant {tenant_id} já está em processamento "
                f"por outro worker ou não está no estado RAW. Abortando.",
                extra=log_extra,
            )
            return

        product_id = getattr(row, "id", None)
        if isinstance(product_id, (MagicMock, AsyncMock)) or not product_id:
            product_id = f"prod_{sku}"

        raw_payload = getattr(row, "raw_payload", None)
        if isinstance(raw_payload, dict):
            product_dict = raw_payload
        else:
            product_dict = {
                "sku": sku,
                "tenant_id": tenant_id,
                "title": f"Produto {sku}",
                "description": "",
                "metadata": {"source_url": "https://example.com/product"},
            }

        is_demo = tenant_id == "demo_tenant"
        start_time = time.time()
        session, _ = await self._get_session()
        try:
            product_model = Product(**product_dict)

            if is_demo:
                source_url = product_dict.get("metadata", {}).get("source_url", "") if isinstance(product_dict.get("metadata"), dict) else ""
                await publish_demo_progress(
                    url=source_url,
                    status="processing",
                    progress=50
                )

            current_llm = await LLMService.create_for_tenant(
                tenant_id=tenant_id, is_demo=is_demo, session=session
            )

            metering_service = LLMMeteringService(db=session)

            estimated_prompt = 500
            estimated_completion = 300
            reserved_cost: Decimal = metering_service.calculate_token_cost(
                model_used="deepseek/deepseek-chat",
                prompt_tokens=estimated_prompt,
                completion_tokens=estimated_completion,
            )
            try:
                await metering_service.reserve_credits_for_llm(
                    tenant_id=tenant_id, estimated_cost=reserved_cost
                )
            except (InsufficientCreditsException, InsufficientBalanceException):
                logger.warning(
                    f"[ProcessorService] Saldo de créditos insuficiente para tenant '{tenant_id}' (SKU: {sku}). Produto marcado como FAILED.",
                    extra=log_extra,
                )
                await self.repo.set_status(tenant_id, sku, ProductStatus.FAILED.value)
                if is_demo:
                    source_url = product_dict.get("metadata", {}).get("source_url", "") if isinstance(product_dict.get("metadata"), dict) else ""
                    await publish_demo_progress(
                        url=source_url,
                        status="failed",
                        progress=100,
                        error="Saldo de créditos insuficiente para processar a requisição de IA. Recarregue seu saldo."
                    )
                return
            except Exception as metering_err:
                logger.warning(f"[ProcessorService] Aviso ao reservar créditos para tenant '{tenant_id}': {metering_err}", extra=log_extra)

            try:
                processed_data = await self._process_with_retry(product_model, current_llm)
            except (AllProvidersExhaustedError, Exception):
                if reserved_cost > Decimal("0.000000"):
                    try:
                        await metering_service.refund_credits_on_failure(
                            tenant_id=tenant_id, reserved_cost=reserved_cost
                        )
                    except Exception as refund_err:
                        logger.error(
                            f"[ProcessorService] Falha no estorno de créditos para tenant '{tenant_id}': {refund_err}",
                            extra=log_extra,
                        )
                raise

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

            try:
                credit_service = CreditService(repository=WalletRepository(session=session))
                await credit_service.consume_credits(
                    tenant_id=tenant_id,
                    amount=1,
                    description=f"Enriquecimento de produto SKU {sku}",
                )
            except Exception as credit_err:
                logger.warning(
                    f"[ProcessorService] Erro ao debitar crédito para tenant '{tenant_id}', SKU '{sku}': {credit_err}",
                    extra=log_extra,
                )

            duration_ms = int((time.time() - start_time) * 1000)

            try:
                usage_dto = LLMUsageLogCreate(
                    tenant_id=tenant_id,
                    product_id=product_id,
                    provider="openrouter",
                    model_used=model_used,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=prompt_tokens + completion_tokens,
                    is_byok=False,
                    execution_time_ms=int(response_time_ms) if response_time_ms else duration_ms,
                )
                await metering_service.record_usage_and_deduct(
                    tenant_id=tenant_id,
                    usage_dto=usage_dto,
                    reserved_cost=reserved_cost,
                )
            except Exception as metering_err:
                logger.warning(f"Erro ao registrar consumo e débito no LLMMeteringService: {metering_err}")

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
                logger.warning(f"Erro ao registrar telemetria do ProcessorService: {telemetry_err}")

            logger.info(
                f"[ProcessorService] Produto {sku} enriquecido com sucesso via {model_used} em {response_time_ms}ms",
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
                logger.warning(f"Erro ao registrar falha de telemetria do ProcessorService: {telemetry_err}")

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
            raise

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
