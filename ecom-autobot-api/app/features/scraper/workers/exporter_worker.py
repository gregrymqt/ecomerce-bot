import os
import asyncio
from datetime import datetime, timezone
import logging
from typing import Optional, Tuple, AsyncGenerator
from dotenv import load_dotenv
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import AsyncSessionLocal
from app.features.products.domain.models import ProductModel
from app.features.products.schemas import Product, ProductStatus
from app.core.shared.csv_exporter import CsvExportService
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

    async def _fetch_products_in_batches(self) -> AsyncGenerator[list[Product], None]:
        """
        Gerador assíncrono que busca produtos em lotes (paginação) 
        para evitar o estouro de memória no contêiner (OOM).
        """
        offset = 0
        while True:
            session, should_close = await self._get_session()
            try:
                stmt = (
                    select(ProductModel)
                    .where(
                        ProductModel.status == ProductStatus.PROCESSED.value,
                        ProductModel.tenant_id == self.tenant_id,
                    )
                    .offset(offset)
                    .limit(self.batch_size)
                )
                
                result = await session.execute(stmt)
                rows = result.scalars().all()
                
                if not rows:
                    break
                    
                products_batch = []
                for row in rows:
                    try:
                        payload = dict(row.raw_payload or {})
                        products_batch.append(Product(**payload))
                    except Exception as e:
                        logger.warning(f"Aviso: Falha ao carregar produto {row.id} via pydantic: {e}")
                
                yield products_batch
                offset += self.batch_size
                
            finally:
                if should_close:
                    await session.close()

    async def export(self) -> None:
        logger.info(f"Iniciando exportação para {self.platform.capitalize()} (Tenant: {self.tenant_id})...")
        
        all_product_dicts = []
        exported_skus = []
        
        # Consome os produtos aos poucos do banco de dados
        async for batch in self._fetch_products_in_batches():
            for p in batch:
                p_dict = p.model_dump()
                p_dict["tags"] = p_dict.get("attributes", {}).get("tags", [])
                p_dict["seo_title"] = p_dict.get("attributes", {}).get("seo_title", p.title)
                p_dict["seo_description"] = p_dict.get("attributes", {}).get("seo_description", p.description[:150])
                all_product_dicts.append(p_dict)
                exported_skus.append(p.sku)

        if not all_product_dicts:
            logger.info("Nenhum produto com status 'processed' encontrado. Nada a exportar.")
            return

        logger.info(f"Extração concluída: {len(all_product_dicts)} produtos enfileirados. Gerando CSV...")

        csv_bytes = b""
        if self.platform == "shopify":
            shopify_products = [ShopifyProductSetInput.from_internal_data(pd) for pd in all_product_dicts]
            csv_bytes = CsvExportService.generate_shopify_csv(shopify_products)
        elif self.platform == "nuvemshop":
            nuvemshop_products = [NuvemshopProductRequest.from_internal_data(pd) for pd in all_product_dicts]
            csv_bytes = CsvExportService.generate_nuvemshop_csv(nuvemshop_products)
        else:
            logger.warning(f"Plataforma '{self.platform}' não configurada no ExporterWorker.")
            return

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"export_{self.platform}_{timestamp}.csv"

        try:
            def _save_file():
                with open(filename, mode='wb') as file:
                    file.write(csv_bytes)

            await asyncio.to_thread(_save_file)
            logger.info(f"Sucesso: Arquivo gerado em '{filename}'.")
            
            # Atualiza o status em massa
            await self.mark_as_exported(exported_skus)

        except Exception as e:
            logger.error(f"Erro crítico ao gerar o arquivo CSV: {e}")

    async def mark_as_exported(self, product_skus: list[str]) -> None:
        if not product_skus:
            return

        session, should_close = await self._get_session()
        try:
            # Substituindo o loop lento por um "Bulk Update" super rápido e leve
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
        finally:
            if should_close:
                await session.close()

if __name__ == "__main__":
    async def main():
        exporter = ExporterWorker(tenant_id="default_tenant", platform="shopify")
        await exporter.export()

    asyncio.run(main())