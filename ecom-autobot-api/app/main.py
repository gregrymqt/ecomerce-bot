import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
import uvicorn

from app.core.config.settings import settings
from app.core.config.redis_db import redis_cache
from app.core.config.rabbitmq import get_rabbitmq_connection, configure_rabbitmq_topology
from app.features.auth.infrastructure import seed_initial_roles
from app.features.products.repositories import ProductRepository
from app.features.scraper.workers.scraper_worker import ScraperWorker
from app.features.scraper.workers.processor_worker import ProcessorWorker
from app.features.api_router import api_router as v1_router
from app.features.ai_enrichment.services.llm_service import LLMService


logger = logging.getLogger(__name__)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando aplicação e conectando aos serviços...")
    await redis_cache.connect()

    # 1. Configura a topologia do RabbitMQ (Filas prod, demo e DLQ dead-letter)
    try:
        connection = await get_rabbitmq_connection()
        async with connection:
            channel = await connection.channel()
            await configure_rabbitmq_topology(channel)
    except Exception as err:
        logger.error(f"Falha ao configurar topologia inicial do RabbitMQ: {err}")

    # 2. Inicializa tabelas e insere as 3 roles padrão ('user', 'ecommerce', 'admin') no banco de dados
    await seed_initial_roles()

    repository = ProductRepository()
    scraper_worker = ScraperWorker(repository)
    llm_service = LLMService()
    processor_worker = ProcessorWorker(repository, llm_service)

    # 3. Inicializa os workers escutando as filas criadas pela topologia
    prod_worker_task = asyncio.create_task(scraper_worker.start_consuming("ecommerce_prod"))
    demo_worker_task = asyncio.create_task(scraper_worker.start_consuming("ecommerce_demo"))
    processor_task = asyncio.create_task(processor_worker.run())

    app.state.worker_tasks = [prod_worker_task, demo_worker_task, processor_task]

    yield

    logger.info("Encerrando aplicação e fechando conexões...")
    for task in app.state.worker_tasks:
        task.cancel()

    await asyncio.gather(*app.state.worker_tasks, return_exceptions=True)
    await redis_cache.disconnect()


app = FastAPI(title="Ecommerce Bot API", lifespan=lifespan)

app.include_router(v1_router, prefix="/api/v1")

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)