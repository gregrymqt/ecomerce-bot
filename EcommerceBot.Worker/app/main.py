import sys
from pathlib import Path

# Garante que o diretório raiz do backend esteja no sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
import uvicorn

from app.core.config.rabbitmq import get_rabbitmq_connection, configure_rabbitmq_topology
from app.ml.ml_worker import consume_ml_queue
from app.scraper.worker import start_scraper_worker

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Iniciando AI/ML Engine Workers (Python)...")

    # 1. Inicializa e provisiona a topologia completa do RabbitMQ (Exchanges, DLQs e Filas)
    try:
        connection = await get_rabbitmq_connection()
        async with connection:
            channel = await connection.channel()
            await configure_rabbitmq_topology(channel)
        logger.info("✅ Topologia RabbitMQ provisionada com sucesso.")
    except Exception as e:
        logger.error(f"⚠️ Falha ao provisionar topologia RabbitMQ no boot: {e}")

    # 2. Inicia as tasks em background (RabbitMQ Consumers)
    worker_tasks = [
        asyncio.create_task(start_scraper_worker(), name="worker_scraper_prod"),
        asyncio.create_task(consume_ml_queue(), name="worker_analytics_ml")
    ]

    app.state.worker_tasks = worker_tasks
    logger.info(f"{len(app.state.worker_tasks)} workers operacionais iniciados com sucesso.")

    yield

    logger.info("🛑 Desligando AI/ML Engine Workers...")
    if hasattr(app.state, "worker_tasks"):
        for task in app.state.worker_tasks:
            task.cancel()
        await asyncio.gather(*app.state.worker_tasks, return_exceptions=True)

    logger.info("Serviços encerrados com sucesso.")

app = FastAPI(title="Ecommerce Bot AI/ML Engine", lifespan=lifespan)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "Python AI/ML Engine"}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)