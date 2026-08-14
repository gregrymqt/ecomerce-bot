import logging
from typing import Optional, Tuple
from urllib.parse import urlparse
from datetime import datetime, timezone
import httpx

from app.core.config.database import AsyncSessionLocal
from app.core.config.settings import settings
from app.features.products.schemas import Product, ScraperMetadata, ProductStatus
from app.features.scraper.parsers.json_ld_parser import JsonLdParserService
from app.features.scraper.parsers.markdown_parser import MarkdownParserService
from app.features.scraper.repositories.scraping_metadata_repository import ScrapingMetadataRepository
from app.features.system.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


class ScrapingExecutionService:
    """
    Serviço de Domínio responsável pelo scraping de páginas de produtos (JSON-LD + Markdown fallback),
    gestão de falhas de scraping por domínio via ScrapingMetadataRepository e envio de alertas no Discord.
    """

    def __init__(
        self,
        session: Optional[AsyncSessionLocal] = None,
        client: Optional[httpx.AsyncClient] = None,
        metadata_repo: Optional[ScrapingMetadataRepository] = None,
    ):
        self.session = session
        self.client = client or httpx.AsyncClient(timeout=10.0, follow_redirects=True)
        self.metadata_repo = metadata_repo or ScrapingMetadataRepository(session=session)
        self.json_ld_parser = JsonLdParserService()

        api_key = settings.DEEPSEEK_API_KEY
        self.markdown_parser = MarkdownParserService(api_key=api_key)
        self.notification_service = NotificationService()

    async def handle_scraping_failure(self, domain: str, error_type: str, url: str):
        failures, silenced_until = await self.metadata_repo.register_failure(domain)

        is_silenced = silenced_until and silenced_until.replace(tzinfo=timezone.utc) > datetime.now(timezone.utc)

        if failures >= 3 and not is_silenced:
            await self.notification_service.send_discord_alert(domain, error_type, url)
            await self.metadata_repo.set_silenced_until(domain, duration_hours=1)

    async def handle_scraping_success(self, domain: str):
        await self.metadata_repo.reset_failures(domain)

    async def process_product_page(self, product_url: str, tenant_id: str) -> Optional[Product]:
        domain = urlparse(product_url).netloc
        error_type = "Parser retornou dados nulos"

        try:
            scraped_data = await self.json_ld_parser.parse(product_url, client=self.client)
            
            if not scraped_data.title or not scraped_data.description:
                logger.info(f"Estratégia 1 (JSON-LD) falhou para {product_url}. Acionando Fallback LLM Markdown.")
                response = await self.client.get(product_url)
                response.raise_for_status()
                scraped_data = await self.markdown_parser.parse(response.text)
                
            if not scraped_data.title:
                logger.warning(f"Não foi possível extrair dados estruturados de {product_url}")
                await self.handle_scraping_failure(domain, error_type, product_url)
                return None
                
            product_obj = Product(
                sku=scraped_data.sku or product_url.split("/")[-2],
                title=scraped_data.title,
                description=scraped_data.description,
                price=float(scraped_data.price) if scraped_data.price else None,
                currency=scraped_data.currency or "BRL",
                images=[scraped_data.image_url] if scraped_data.image_url else [],
                metadata=ScraperMetadata(source_url=product_url),
                status=ProductStatus.RAW,
                tenant_id=tenant_id
            )
            
            await self.handle_scraping_success(domain)
            return product_obj
            
        except Exception as e:
            logger.error(f"Erro ao processar página de produto {product_url}: {e}")
            await self.handle_scraping_failure(domain, str(e), product_url)
            return None
