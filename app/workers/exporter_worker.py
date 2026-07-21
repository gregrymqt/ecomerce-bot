import os
import asyncio
from datetime import datetime, timezone
import logging
from dotenv import load_dotenv

from app.config.database import AsyncSessionLocal
from app.models.database_models import ProductModel
from app.models.products import Product, ProductStatus
from app.exporters.csv_exporter import CsvExportService
from sqlalchemy import select

load_dotenv()
logger = logging.getLogger(__name__)

class ExporterWorker:
    """
    Worker assíncrono responsável por buscar produtos enriquecidos e integrá-los
    com o novo motor CsvExportService.
    """
    def __init__(self, tenant_id: str, platform="shopify"):
        self.tenant_id = tenant_id
        self.platform = platform.lower()

    async def fetch_processed_products(self):
        """Busca no PostgreSQL os produtos que já passaram pela IA e estão com status 'processed'."""
        try:
            async with AsyncSessionLocal() as session:
                stmt = select(ProductModel).where(
                    ProductModel.status == ProductStatus.PROCESSED.value,
                    ProductModel.tenant_id == self.tenant_id,
                ).limit(5000)
                result = await session.execute(stmt)
                rows = result.scalars().all()

            products = []
            for row in rows:
                try:
                    payload = dict(row.raw_payload or {})
                    products.append(Product(**payload))
                except Exception as e:
                    logger.warning(f"Aviso: Não foi possível carregar o produto {row.id} no modelo Product. Erro: {e}")
            return products
        except Exception as e:
            logger.error(f"Erro ao buscar produtos no PostgreSQL: {e}")
            return []

    async def export(self):
        """Executa o fluxo completo: Buscar, delegar pro Service, salvar e atualizar Banco."""
        logger.info(f"Iniciando processo de exportação para {self.platform.capitalize()}...")

        products = await self.fetch_processed_products()

        if not products:
            logger.info("Nenhum produto com status 'processed' encontrado. Nada a exportar.")
            return

        logger.info(f"Encontrados {len(products)} produtos para exportar.")

        # Preparar dados para o Export Service (convertendo do Modelo Pydantic)
        product_dicts = []
        for p in products:
            p_dict = p.model_dump()
            # Mapeia atributos caso a LLM tenha gerado tags e campos SEO dentro do dict 'attributes'
            p_dict["tags"] = p_dict.get("attributes", {}).get("tags", [])
            p_dict["seo_title"] = p_dict.get("attributes", {}).get("seo_title", p.title)
            p_dict["seo_description"] = p_dict.get("attributes", {}).get("seo_description", p.description[:150])
            product_dicts.append(p_dict)

        # Delegação para o CsvExportService
        csv_bytes = b""
        if self.platform == "shopify":
            from app.models.shopify_models import ShopifyProductSetInput
            shopify_products = [ShopifyProductSetInput.from_internal_data(pd) for pd in product_dicts]
            csv_bytes = CsvExportService.generate_shopify_csv(shopify_products)
        elif self.platform == "nuvemshop":
            from app.models.nuvemshop_models import NuvemshopProductRequest
            nuvemshop_products = [NuvemshopProductRequest.from_internal_data(pd) for pd in product_dicts]
            csv_bytes = CsvExportService.generate_nuvemshop_csv(nuvemshop_products)
        else:
            logger.warning(f"Plataforma '{self.platform}' não configurada no ExporterWorker.")
            return

        # Simula a gravação de um arquivo localmente por agora (ou pode ser repassado via API)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"export_{self.platform}_{timestamp}.csv"

        try:
            def _save_file():
                with open(filename, mode='wb') as file:
                    file.write(csv_bytes)

            await asyncio.to_thread(_save_file)

            logger.info(f"Sucesso: Arquivo gerado em '{filename}'.")

            # Etapa crucial: marcar no banco como exportado para evitar duplicidade
            await self.mark_as_exported([p.sku for p in products])

        except Exception as e:
            logger.error(f"Erro crítico ao gerar o arquivo CSV: {e}")

    async def mark_as_exported(self, product_skus):
        """Atualiza os documentos exportados para 'status: Exported' no PostgreSQL."""
        if not product_skus:
            return

        try:
            async with AsyncSessionLocal() as session:
                stmt = (
                    select(ProductModel)
                    .where(
                        ProductModel.tenant_id == self.tenant_id,
                        ProductModel.sku.in_(product_skus),
                    )
                )
                result = await session.execute(stmt)
                rows = result.scalars().all()
                count = 0
                for row in rows:
                    row.status = ProductStatus.EXPORTED.value
                    count += 1
                await session.commit()
            logger.info(f"Concluído: {count} documentos marcados como 'Exported' no PostgreSQL.")
        except Exception as e:
            logger.error(f"Erro ao atualizar o status no PostgreSQL: {e}")

if __name__ == "__main__":
    async def main():
        exporter = ExporterWorker(tenant_id="default_tenant", platform="shopify")
        await exporter.export()

    asyncio.run(main())
