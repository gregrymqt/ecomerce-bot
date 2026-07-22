import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
import uvicorn

from app.config.settings import settings
from app.config.redis_db import redis_cache
from app.repositories.product_repository import ProductRepository
from app.workers.scraper_worker import ScraperWorker
from app.workers.processor_worker import ProcessorWorker
from app.services.llm_service import LLMService
from app.api.v1.api import router as v1_router

logger = logging.getLogger(__name__)

# Configuração global de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Iniciando aplicação e conectando aos serviços...")
    await redis_cache.connect()
    
    repository = ProductRepository()
    scraper_worker = ScraperWorker(repository)
    llm_service = LLMService()
    processor_worker = ProcessorWorker(repository, llm_service)
    
    # Inicia as tasks em background para os workers não bloquearem o servidor HTTP
    prod_worker_task = asyncio.create_task(scraper_worker.start_consuming("ecommerce_prod"))
    demo_worker_task = asyncio.create_task(scraper_worker.start_consuming("ecommerce_demo"))
    processor_task = asyncio.create_task(processor_worker.run())
    
    app.state.worker_tasks = [prod_worker_task, demo_worker_task, processor_task]

    yield
    
    # Shutdown
    logger.info("Encerrando aplicação e fechando conexões...")
    for task in app.state.worker_tasks:
        task.cancel()
    
    await asyncio.gather(*app.state.worker_tasks, return_exceptions=True)
    await redis_cache.disconnect()

app = FastAPI(title="Ecommerce Bot API", lifespan=lifespan)

app.include_router(v1_router, prefix="/api/v1")

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)