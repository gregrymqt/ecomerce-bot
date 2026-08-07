import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.core.config.settings import settings
from app.core.config.redis_db import redis_cache
from app.core.config.rabbitmq import get_rabbitmq_connection, configure_rabbitmq_topology
from app.features.auth.infrastructure import seed_initial_roles, seed_admin_users
from app.features.products.repositories import ProductRepository
from app.features.scraper.workers.scraper_worker import ScraperWorker
from app.features.scraper.workers.processor_worker import ProcessorWorker
from app.features.checkout.workers.payment_worker import PaymentWorker
from app.features.subscriptions.workers import SubscriptionWorker
from app.features.mercadopago.workers.webhook_worker import WebhookDispatcherWorker
from app.features.api_router import api_router as v1_router
from app.features.ai_enrichment.services.llm_service import LLMService

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando aplicação e conectando aos serviços...")
    await redis_cache.connect()

    rabbitmq_conn = await get_rabbitmq_connection()
    try:
        channel = await rabbitmq_conn.channel()
        await configure_rabbitmq_topology(channel)
    except Exception as err:
        logger.error(f"Falha ao configurar topologia inicial do RabbitMQ: {err}")
        raise err

    await seed_initial_roles()
    await seed_admin_users()

    repository = ProductRepository()
    llm_service = LLMService()

    scraper_worker = ScraperWorker(repository)
    processor_worker = ProcessorWorker(repository, llm_service)
    webhook_worker = WebhookDispatcherWorker()
    payment_worker = PaymentWorker()
    subscription_worker = SubscriptionWorker()

    worker_tasks = [
        asyncio.create_task(scraper_worker.start_consuming("ecommerce", channel=channel), name="worker_scraper_prod"),
        asyncio.create_task(scraper_worker.start_consuming("demo_ecommerce", channel=channel), name="worker_scraper_demo"),
        asyncio.create_task(processor_worker.start_consuming("llm", channel=channel), name="worker_processor_llm_prod"),
        asyncio.create_task(processor_worker.start_consuming("demo_llm", channel=channel), name="worker_processor_llm_demo"),
        asyncio.create_task(webhook_worker.start_consuming("webhook", channel=channel), name="worker_webhook"),
        asyncio.create_task(payment_worker.start_consuming("payments", channel=channel), name="worker_payments"),
        asyncio.create_task(subscription_worker.start_consuming("subscription", channel=channel), name="worker_subscription"),
    ]

    app.state.worker_tasks = worker_tasks
    logger.info(f"{len(app.state.worker_tasks)} workers operacionais iniciados com sucesso.")

    yield

    logger.info("Encerrando aplicação e fechando conexões...")
    if hasattr(app.state, "worker_tasks"):
        for task in app.state.worker_tasks:
            task.cancel()
        await asyncio.gather(*app.state.worker_tasks, return_exceptions=True)

    try:
        if rabbitmq_conn and not rabbitmq_conn.is_closed:
            await rabbitmq_conn.close()
    except Exception as e:
        logger.warning(f"Erro ao fechar conexão do RabbitMQ: {e}")
    finally:
        await redis_cache.disconnect()

    logger.info("Serviços encerrados com sucesso.")


app = FastAPI(title="Ecommerce Bot API", lifespan=lifespan)

# Configuração de CORS Seguro
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Tenant-ID"],
)

# Middleware de Segurança e Limite de Payload (DoS Protection)
@app.middleware("http")
async def security_and_payload_limit_middleware(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > settings.MAX_PAYLOAD_SIZE_BYTES:
        return Response(
            content='{"detail": "Payload excede o limite máximo permitido."}',
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            media_type="application/json"
        )
    
    response = await call_next(request)
    
    # Headers de Segurança no nível de resposta da API
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

app.include_router(v1_router, prefix="/api/v1")

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)