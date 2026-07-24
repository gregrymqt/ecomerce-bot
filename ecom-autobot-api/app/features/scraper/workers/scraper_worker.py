import httpx
import asyncio
import logging
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from datetime import datetime, timezone, timedelta
import aio_pika
import json

from app.features.products.schemas import Product, ScraperMetadata, ProductStatus
from app.features.scraper.schemas import ImportRequestMessage
from app.features.scraper.parsers.json_ld_parser import JsonLdParserService
from app.features.scraper.parsers.markdown_parser import MarkdownParserService
from app.features.system.services import NotificationService
from app.core.config.database import AsyncSessionLocal
from app.features.products.domain.models import ScrapingMetadataModel
from app.core.config.settings import settings
from app.core.config.rabbitmq import get_rabbitmq_connection, configure_rabbitmq_topology
from app.core.shared.progress import publish_demo_progress

class ScraperWorker:
    def __init__(self, repository):
        self.client = httpx.AsyncClient(timeout=10.0, follow_redirects=True)
        self.repository = repository
        self.json_ld_parser = JsonLdParserService()

        api_key = settings.DEEPSEEK_API_KEY
        self.markdown_parser = MarkdownParserService(api_key=api_key)
        self.notification_service = NotificationService()

    async def _handle_scraping_failure(self, domain: str, error_type: str, url: str):
        async with AsyncSessionLocal() as session:
            meta = await session.get(ScrapingMetadataModel, domain)
            if meta is None:
                meta = ScrapingMetadataModel(domain=domain, consecutive_failures=1)
                session.add(meta)
            else:
                current = meta.consecutive_failures or 0
                meta.consecutive_failures = current + 1
            await session.commit()

            failures = meta.consecutive_failures or 1
            silenced_until = meta.silenced_until

        is_silenced = silenced_until and silenced_until.replace(tzinfo=timezone.utc) > datetime.now(timezone.utc)

        if failures >= 3 and not is_silenced:
            await self.notification_service.send_discord_alert(domain, error_type, url)

            async with AsyncSessionLocal() as session:
                meta = await session.get(ScrapingMetadataModel, domain)
                if meta is not None:
                    meta.silenced_until = datetime.now(timezone.utc) + timedelta(hours=1)
                    await session.commit()

    async def _handle_scraping_success(self, domain: str):
        async with AsyncSessionLocal() as session:
            meta = await session.get(ScrapingMetadataModel, domain)
            if meta is not None and (meta.consecutive_failures or 0) > 0:
                meta.consecutive_failures = 0
                await session.commit()

    async def _process_product_page(self, product_url: str, tenant_id: str):
        domain = urlparse(product_url).netloc
        error_type = "Parser retornou dados nulos"

        try:
            scraped_data = await self.json_ld_parser.parse(product_url, client=self.client)
            
            if not scraped_data.title or not scraped_data.description:
                logging.info(f"Estratégia 1 falhou para {product_url}. Acionando Fallback LLM.")
                response = await self.client.get(product_url)
                response.raise_for_status()
                scraped_data = await self.markdown_parser.parse(response.text)
                
            if not scraped_data.title:
                logging.warning(f"Não foi possível extrair dados estruturados de {product_url}")
                await self._handle_scraping_failure(domain, error_type, product_url)
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
            
            await self._handle_scraping_success(domain)
            return product_obj
            
        except Exception as e:
            logging.error(f"Erro ao processar página de produto {product_url}: {e}")
            await self._handle_scraping_failure(domain, str(e), product_url)
            return None

    async def run(self, base_url: str):
        current_url = base_url
        
        while current_url:
            logging.info(f"Scraping catálogo: {current_url}")
            
            try:
                response = await self.client.get(current_url)
                if response.status_code != 200:
                    break
                
                soup = BeautifulSoup(response.text, 'html.parser')
                products_elements = soup.select("article.product_pod h3 a")
                product_links = [urljoin(current_url, el["href"]) for el in products_elements]
                
                for product_url in product_links:
                    product_obj = await self._process_product_page(product_url, tenant_id="default")
                    if product_obj:
                        await self.repository.upsert_product(product_obj)
                    await asyncio.sleep(1)
                
                next_button = soup.select_one("li.next > a")
                if next_button:
                    current_url = urljoin(current_url, next_button["href"])
                else:
                    logging.info("Fim da paginação.")
                    current_url = None
                
                await asyncio.sleep(2)
                
            except Exception as e:
                logging.error(f"Erro na navegação do catálogo: {e}")
                break

    async def start_consuming(self, queue_name: str = "ecommerce_prod"):
        try:
            connection = await get_rabbitmq_connection()
            async with connection:
                channel = await connection.channel()
                
                await configure_rabbitmq_topology(channel)
                await channel.set_qos(prefetch_count=1)
                queue = await channel.get_queue(queue_name)
                
                logging.info(f"Worker is waiting for messages in {queue_name}. To exit press CTRL+C")
                
                async with queue.iterator() as queue_iter:
                    async for message in queue_iter:
                        async with message.process(requeue=False, ignore_processed=True):
                            try:
                                payload = message.body.decode()
                                logging.info(f"Received message on {queue_name}: {payload}")
                                
                                raw_data = json.loads(payload)
                                msg_model = ImportRequestMessage.model_validate(raw_data)
                                url_to_scrape = msg_model.target_url
                                tenant_id = msg_model.tenant_id
                                if url_to_scrape:
                                    if queue_name == "ecommerce_demo":
                                        await publish_demo_progress(url_to_scrape, "scraping", 30)

                                    product = await self._process_product_page(url_to_scrape, tenant_id)
                                    if product:
                                        if queue_name == "ecommerce_demo":
                                            original_data = {
                                                "title": product.title,
                                                "description": product.description,
                                                "price": str(product.price) if product.price else None,
                                                "imageUrl": product.images[0] if product.images else None
                                            }
                                            await publish_demo_progress(url_to_scrape, "generating", 70, original=original_data)
                                        await self.repository.upsert_product(product)
                                    else:
                                        if queue_name == "ecommerce_demo":
                                            await publish_demo_progress(url_to_scrape, "failed", 100, error="Falha ao extrair dados do produto.")
                                        
                            except Exception as process_err:
                                logging.error(f"Erro ao processar mensagem do RabbitMQ: {process_err}")
                                if queue_name == "ecommerce_demo" and url_to_scrape:
                                    await publish_demo_progress(url_to_scrape, "failed", 100, error=str(process_err))
                                raise
        except Exception as e:
            logging.error(f"Erro assíncrono na conexão/consumo do RabbitMQ: {e}")
