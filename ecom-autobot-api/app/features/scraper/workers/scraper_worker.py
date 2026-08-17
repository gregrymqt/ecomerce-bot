from typing import Any
import time
from typing import Optional, Tuple
import asyncio
import logging
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import aio_pika
import json
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.scraper.schemas import ImportRequestMessage
from app.features.scraper.services.scraping_execution_service import ScrapingExecutionService
from app.features.system.repositories import TelemetryRepository
from app.core.config.database import AsyncSessionLocal
from app.core.config.rabbitmq import get_rabbitmq_connection
from app.core.shared.progress import publish_demo_progress


class ScraperWorker:
    """
    Worker de Background responsável por consumir URLs para Web Scraping na fila RabbitMQ ('ecommerce'),
    salvar o produto no banco em estado RAW e enfileirar a próxima etapa de enriquecimento por IA.
    """

    def __init__(self, repository: Optional[Any] = None, session: Optional[AsyncSession] = None):
        if repository is None:
            from app.features.products.repositories import product_repository
            repository = product_repository
        self.repository = repository
        self.session = session
        self.execution_service = ScrapingExecutionService(session=session)


    async def _get_session(self) -> Tuple[AsyncSession, bool]:
        if self.session is not None:
            return self.session, False
        session = AsyncSessionLocal()
        return session, True

    async def run(self, base_url: str):
        """Método legado de navegação sequencial em catálogos HTML."""
        current_url = base_url
        
        while current_url:
            logging.info(f"Scraping catálogo: {current_url}")
            
            try:
                response = await self.execution_service.client.get(current_url)
                if response.status_code != 200:
                    break
                
                soup = BeautifulSoup(response.text, 'html.parser')
                products_elements = soup.select("article.product_pod h3 a")
                product_links = [urljoin(current_url, el["href"]) for el in products_elements]
                
                for product_url in product_links:
                    product_obj = await self.execution_service.process_product_page(product_url, tenant_id="default")
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

    async def start_consuming(self, queue_name: str = "ecommerce", channel: aio_pika.abc.AbstractChannel | None = None) -> None:
        """
        Inicia o consumo das mensagens na fila especificada.
        """
        try:
            if channel is None:
                connection = await get_rabbitmq_connection()
                channel = await connection.channel()
                
            await channel.set_qos(prefetch_count=1)
            queue = await channel.get_queue(queue_name)
            
            logging.info(f"ScraperWorker aguardando mensagens na fila '{queue_name}'...")
            
            async with queue.iterator() as queue_iter:
                async for message in queue_iter:
                    url_to_scrape = None
                    try:
                        async with message.process(requeue=False, ignore_processed=True):
                            start_time = time.time()
                            payload = message.body.decode()
                            logging.info(f"Mensagem recebida em {queue_name}: {payload}")
                            
                            raw_data = json.loads(payload)
                            msg_model = ImportRequestMessage.model_validate(raw_data)
                            
                            url_to_scrape = msg_model.target_url
                            tenant_id = msg_model.tenant_id
                            
                            if url_to_scrape:
                                if queue_name == "demo_ecommerce":
                                    await publish_demo_progress(url_to_scrape, "scraping", 30)

                                # 1. Realiza o Scraping via ScrapingExecutionService
                                product = await self.execution_service.process_product_page(url_to_scrape, tenant_id)
                                duration_ms = int((time.time() - start_time) * 1000)
                                
                                if product:
                                    if queue_name == "demo_ecommerce":
                                        original_data = {
                                            "title": product.title,
                                            "description": product.description,
                                            "price": str(product.price) if product.price else None,
                                            "imageUrl": product.images[0] if product.images else None
                                        }
                                        await publish_demo_progress(url_to_scrape, "generating", 70, original=original_data)
                                    
                                    # 2. Salva no Banco de Dados com status RAW
                                    await self.repository.upsert_product(product)

                                    try:
                                        telemetry_repo = TelemetryRepository(session=self.session)
                                        await telemetry_repo.log_activity(
                                            tenant_id=tenant_id,
                                            worker_type="scraper",
                                            status="SUCCESS",
                                            details={"url": url_to_scrape, "sku": product.sku},
                                            duration_ms=duration_ms
                                        )
                                    except Exception as telemetry_err:
                                        logging.warning(f"Erro ao registrar telemetria do ScraperWorker: {telemetry_err}")
                                    
                                    # 3. Dispara evento para o ProcessorWorker (LLM)
                                    llm_routing_key = "demo_llm" if queue_name == "demo_ecommerce" else "llm"
                                    
                                    llm_payload = json.dumps({
                                        "tenant_id": tenant_id,
                                        "sku": product.sku
                                    }).encode()

                                    await channel.default_exchange.publish(
                                        aio_pika.Message(
                                            body=llm_payload,
                                            content_type="application/json",
                                            delivery_mode=aio_pika.DeliveryMode.PERSISTENT
                                        ),
                                        routing_key=llm_routing_key
                                    )
                                    
                                    logging.info(f"Tarefa de IA enfileirada na '{llm_routing_key}' para SKU: {product.sku}")
                                else:
                                    try:
                                        telemetry_repo = TelemetryRepository(session=self.session)
                                        await telemetry_repo.log_activity(
                                            tenant_id=tenant_id,
                                            worker_type="scraper",
                                            status="FAILED",
                                            details={"url": url_to_scrape},
                                            duration_ms=duration_ms
                                        )
                                    except Exception as telemetry_err:
                                        logging.warning(f"Erro ao registrar telemetria de falha do ScraperWorker: {telemetry_err}")

                                    if queue_name == "demo_ecommerce":
                                        await publish_demo_progress(url_to_scrape, "failed", 100, error="Falha ao extrair dados do produto.")

                    except asyncio.CancelledError:
                        raise
                    except Exception as process_err:
                        logging.error(f"Erro ao processar mensagem do RabbitMQ no ScraperWorker: {process_err}", exc_info=True)
                        if queue_name == "demo_ecommerce" and url_to_scrape:
                            try:
                                await publish_demo_progress(url_to_scrape, "failed", 100, error=str(process_err))
                            except Exception:
                                pass
                        try:
                            await message.nack(requeue=False)
                        except Exception:
                            pass

        except asyncio.CancelledError:
            logging.info("🛑 [ScraperWorker] Task do worker encerrada graciosamente.")
            raise
        except Exception as e:
            logging.error(f"Erro assíncrono na conexão/consumo do RabbitMQ no ScraperWorker: {e}")


scraper_worker = ScraperWorker()


if __name__ == "__main__":

    import asyncio
    from app.features.products.repositories import ProductRepository

    async def main():
        repository = ProductRepository()
        worker = ScraperWorker(repository)
        await worker.start_consuming()

    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logging.info("🛑 Worker interrompido manualmente.")