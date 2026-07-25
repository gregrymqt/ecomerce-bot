import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
import uvicorn

from app.core.config.redis_db import redis_cache
from app.core.config.rabbitmq import get_rabbitmq_connection, configure_rabbitmq_topology
from app.features.auth.infrastructure import seed_initial_roles
from app.features.products.repositories import ProductRepository
from app.features.scraper.workers.scraper_worker import ScraperWorker
from app.features.scraper.workers.processor_worker import ProcessorWorker
from app.features.api_router import api_router as v1_router
from app.features.ai_enrichment.services.llm_service import LLMService

# TODO: Descomentar após implementar os workers do Mercado Pago
# from app.features.mercadopago.workers.webhook_worker import WebhookDispatcherWorker
# from app.features.mercadopago.workers.payment_worker import PaymentWorker
# from app.features.mercadopago.workers.subscription_worker import SubscriptionWorker

logger = logging.getLogger(__name__)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando aplicação e conectando aos serviços...")
    await redis_cache.connect()

    # 1. Conexão única com o RabbitMQ e configuração da topologia completa
    rabbitmq_conn = await get_rabbitmq_connection()
    try:
        channel = await rabbitmq_conn.channel()
        await configure_rabbitmq_topology(channel)
    except Exception as err:
        logger.error(f"Falha ao configurar topologia inicial do RabbitMQ: {err}")
        raise err

    # 2. Inicializa dados essenciais do banco e repositórios
    await seed_initial_roles()

    repository = ProductRepository()
    llm_service = LLMService()

    # Instâncias dos Workers Operacionais
    scraper_worker = ScraperWorker(repository)
    processor_worker = ProcessorWorker(repository, llm_service)

    # TODO: Instanciar os workers do Mercado Pago quando criados
    # webhook_worker = WebhookDispatcherWorker()
    # payment_worker = PaymentWorker()
    # subscription_worker = SubscriptionWorker()

    # 3. Inicializa os workers de background reaproveitando o canal ativo
    worker_tasks = [
        # Scraping de Produtos (Produção & Demo)
        asyncio.create_task(
            scraper_worker.start_consuming("ecommerce", channel=channel), 
            name="worker_scraper_prod"
        ),
        asyncio.create_task(
            scraper_worker.start_consuming("demo_ecommerce", channel=channel), 
            name="worker_scraper_demo"
        ),
        
        # Enriquecimento com IA / LLM (Produção & Demo)
        asyncio.create_task(
            processor_worker.start_consuming("llm", channel=channel), 
            name="worker_processor_llm_prod"
        ),
        asyncio.create_task(
            processor_worker.start_consuming("demo_llm", channel=channel), 
            name="worker_processor_llm_demo"
        ),

        # TODO: Ativar quando os workers do Mercado Pago estiverem prontos
        # asyncio.create_task(webhook_worker.start_consuming("webhook", channel=channel), name="worker_webhook"),
        # asyncio.create_task(payment_worker.start_consuming("payments", channel=channel), name="worker_payments"),
        # asyncio.create_task(subscription_worker.start_consuming("subscription", channel=channel), name="worker_subscription"),
    ]

    app.state.worker_tasks = worker_tasks
    logger.info(f"{len(app.state.worker_tasks)} workers operacionais iniciados com sucesso no Event Loop.")

    yield

    # 4. Encerramento gracioso (Graceful Shutdown)
    logger.info("Encerrando aplicação e fechando conexões...")
    
    for task in app.state.worker_tasks:
        task.cancel()

    await asyncio.gather(*app.state.worker_tasks, return_exceptions=True)
    
    await rabbitmq_conn.close()
    await redis_cache.disconnect()
    logger.info("Serviços e conexões encerrados com sucesso.")


app = FastAPI(title="Ecommerce Bot API", lifespan=lifespan)

app.include_router(v1_router, prefix="/api/v1")

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)