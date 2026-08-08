import asyncio
from datetime import datetime, timezone
import logging
from typing import Optional, Tuple, AsyncGenerator
import aiofiles
from dotenv import load_dotenv
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import AsyncSessionLocal
from app.features.products.domain.models import ProductModel
from app.features.products.schemas import Product, ProductStatus
from app.core.shared.csv_exporter import CsvExportService
from app.core.shared.progress import publish_export_progress
from app.features.shopify.schemas import ShopifyProductSetInput
from app.features.nuvemshop.schemas import NuvemshopProductRequest

load_dotenv()
logger = logging.getLogger(__name__)

class ExporterWorker:
    def __init__(self, tenant_id: str, platform="shopify", session: Optional[AsyncSession] = None):
        self.tenant_id = tenant_id
        self.platform = platform.lower()
        self.session = session
        self.batch_size = 500  # Processa 500 registros por vez para não estourar a RAM

    async def _get_session(self) -> Tuple[AsyncSession, bool]:
        if self.session is not None:
            return self.session, False
        session = AsyncSessionLocal()
        return session, True

    async def _count_processed_products(self) -> int:
        """Retorna o total de produtos elegíveis (status PROCESSED) para exportação."""
        session, should_close = await self._get_session()
        try:
            stmt = (
                select(func.count())
                .select_from(ProductModel)
                .where(
                    ProductModel.status == ProductStatus.PROCESSED.value,
                    ProductModel.tenant_id == self.tenant_id,
                )
            )
            result = await session.execute(stmt)
            return result.scalar_one() or 0
        finally:
            if should_close:
                await session.close()

    async def _fetch_products_in_batches(self) -> AsyncGenerator[list[Product], None]:
        """
        Gerador assíncrono que busca produtos em lotes via paginação por ID (keyset),
        evitando estouro de memória (OOM) e saltos de offset durante mutação de status.
        """
        last_id = ""
        while True:
            session, should_close = await self._get_session()
            try:
                stmt = (
                    select(ProductModel)
                    .where(
                        ProductModel.status == ProductStatus.PROCESSED.value,
                        ProductModel.tenant_id == self.tenant_id,
                    )
                )
                if last_id:
                    stmt = stmt.where(ProductModel.id > last_id)

                stmt = stmt.order_by(ProductModel.id).limit(self.batch_size)
                
                result = await session.execute(stmt)
                rows = list(result.scalars().all())
                
                if not rows:
                    break

                last_id = rows[-1].id
                    
                products_batch = []
                for row in rows:
                    try:
                        payload = dict(row.raw_payload or {})
                        products_batch.append(Product(**payload))
                    except Exception as e:
                        logger.warning(f"Aviso: Falha ao carregar produto {row.id} via pydantic: {e}")
                
                yield products_batch
                
            finally:
                if should_close:
                    await session.close()

    async def stream_export(self) -> AsyncGenerator[str, None]:
        """
        Gera e emite chunks de dados CSV diretamente em streaming assíncrono.
        Publica telemetria no Redis Pub/Sub e atualiza atômica o status no PostgreSQL.
        """
        logger.info(f"Iniciando streaming de exportação para {self.platform.capitalize()} (Tenant: {self.tenant_id})...")

        total_items = await self._count_processed_products()
        processed_items = 0

        # Dispara evento inicial: export_started
        await publish_export_progress(
            tenant_id=self.tenant_id,
            event="export_started",
            total_items=total_items,
            processed_items=0,
            percentage=0.0,
            status="PROCESSING"
        )

        try:
            async def product_batch_generator() -> AsyncGenerator[list, None]:
                nonlocal processed_items
                async for batch in self._fetch_products_in_batches():
                    if not batch:
                        continue

                    converted_batch = []
                    exported_skus = []
                    for p in batch:
                        p_dict = p.model_dump()
                        p_dict["tags"] = p_dict.get("attributes", {}).get("tags", [])
                        p_dict["seo_title"] = p_dict.get("attributes", {}).get("seo_title", p.title)
                        p_dict["seo_description"] = p_dict.get("attributes", {}).get("seo_description", p.description[:150])

                        if self.platform == "shopify":
                            converted_batch.append(ShopifyProductSetInput.from_internal_data(p_dict))
                        elif self.platform == "nuvemshop":
                            converted_batch.append(NuvemshopProductRequest.from_internal_data(p_dict))
                        else:
                            converted_batch.append(p)
                        exported_skus.append(p.sku)

                    yield converted_batch
                    
                    # Atualiza o status do lote processado no PostgreSQL
                    await self.mark_as_exported(exported_skus)

                    processed_items += len(exported_skus)
                    pct = round((processed_items / total_items) * 100, 2) if total_items > 0 else 100.0

                    # Dispara evento de progresso: export_progress
                    await publish_export_progress(
                        tenant_id=self.tenant_id,
                        event="export_progress",
                        total_items=total_items,
                        processed_items=processed_items,
                        percentage=pct,
                        status="PROCESSING"
                    )

            if self.platform == "shopify":
                async for chunk in CsvExportService.stream_shopify_csv(product_batch_generator()):
                    yield chunk
            elif self.platform == "nuvemshop":
                async for chunk in CsvExportService.stream_nuvemshop_csv(product_batch_generator()):
                    yield chunk
            else:
                logger.warning(f"Plataforma '{self.platform}' não configurada no ExporterWorker.")
                yield ""

            # Dispara evento de conclusão: export_completed
            await publish_export_progress(
                tenant_id=self.tenant_id,
                event="export_completed",
                total_items=total_items,
                processed_items=processed_items,
                percentage=100.0,
                status="COMPLETED"
            )

        except Exception as exc:
            logger.error(f"Erro crítico na exportação em streaming para Tenant '{self.tenant_id}': {exc}")
            await publish_export_progress(
                tenant_id=self.tenant_id,
                event="export_failed",
                total_items=total_items,
                processed_items=processed_items,
                percentage=round((processed_items / total_items) * 100, 2) if total_items > 0 else 0.0,
                status="FAILED",
                error=str(exc)
            )
            raise exc

    async def export(self) -> str:
        """
        Exporta o CSV gravando diretamente em disco por streaming de chunks,
        sem acumular a lista completa de produtos na RAM.

        Utiliza `aiofiles` para I/O assíncrono, garantindo que a gravação em
        disco nunca bloqueie a Event Loop durante exportações de catálogos grandes.
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"export_{self.platform}_{self.tenant_id}_{timestamp}.csv"

        logger.info(f"Iniciando gravação streaming em arquivo '{filename}' (Tenant: {self.tenant_id})...")
        count_chunks = 0

        async with aiofiles.open(filename, mode="w", encoding="utf-8-sig") as f:
            async for chunk in self.stream_export():
                await f.write(chunk)
                count_chunks += 1

        logger.info(f"Sucesso: Arquivo '{filename}' gerado com {count_chunks} chunks.")
        return filename

    async def mark_as_exported(self, product_skus: list[str]) -> None:
        if not product_skus:
            return

        session, should_close = await self._get_session()
        try:
            # Bulk Update no PostgreSQL
            stmt = (
                update(ProductModel)
                .where(
                    ProductModel.tenant_id == self.tenant_id,
                    ProductModel.sku.in_(product_skus),
                )
                .values(status=ProductStatus.EXPORTED.value)
            )
            result = await session.execute(stmt)
            await session.commit()
            logger.info(f"Concluído: {result.rowcount} documentos marcados como 'Exported' no PostgreSQL.")
        except Exception as e:
            logger.error(f"Erro ao atualizar o status no PostgreSQL: {e}")
            await session.rollback()
            raise
        finally:
            if should_close:
                await session.close()

if __name__ == "__main__":
    async def main():
        exporter = ExporterWorker(tenant_id="default_tenant", platform="shopify")
        await exporter.export()

    asyncio.run(main())