import sys
from pathlib import Path

# Garante que o diretório raiz do backend esteja no sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.responses import JSONResponse
import uvicorn

from app.core.shared.logger import get_logger
from app.core.config.redis_db import redis_cache
from app.core.config.rabbitmq import get_rabbitmq_connection, configure_rabbitmq_topology
from app.ml.ml_worker import consume_ml_queue
from app.scraper.worker import start_scraper_worker

logger = get_logger("worker.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando AI/ML Engine Workers (Python)...")

    # 1. Inicializa o cliente e pooling do Redis (SafeCache)
    try:
        await redis_cache.connect()
        logger.info("Redis inicializado com sucesso.")
    except Exception as e:
        logger.warning(f"Aviso: Não foi possível conectar ao Redis na inicialização: {e}")

    # 2. Inicializa e provisiona a topologia completa do RabbitMQ (Exchanges, DLQs e Filas)
    try:
        connection = await get_rabbitmq_connection()
        async with connection:
            channel = await connection.channel()
            await configure_rabbitmq_topology(channel)
        logger.info("Topologia RabbitMQ provisionada com sucesso.")
    except Exception as e:
        logger.error(f"Falha ao provisionar topologia RabbitMQ no boot: {e}")

    # 3. Inicia as tasks em background (RabbitMQ Consumers)
    worker_tasks = [
        asyncio.create_task(start_scraper_worker(), name="worker_scraper_prod"),
        asyncio.create_task(consume_ml_queue(), name="worker_analytics_ml")
    ]

    app.state.worker_tasks = worker_tasks
    logger.info(f"{len(app.state.worker_tasks)} workers operacionais iniciados com sucesso.")

    yield

    logger.info("Desligando AI/ML Engine Workers graciosamente...")
    if hasattr(app.state, "worker_tasks"):
        for task in app.state.worker_tasks:
            task.cancel()
        await asyncio.gather(*app.state.worker_tasks, return_exceptions=True)

    # Desconexão graciosa do Redis
    try:
        await redis_cache.disconnect()
        logger.info("Conexão Redis encerrada com sucesso.")
    except Exception as e:
        logger.warning(f"Erro ao desconectar do Redis: {e}")

    logger.info("Serviços encerrados com sucesso.")

app = FastAPI(title="Ecommerce Bot AI/ML Engine", lifespan=lifespan)

@app.get("/health/live")
@app.get("/health")
async def liveness_check():
    """Liveness probe: Valida estritamente se o event loop ASGI está vivo (Zero I/O externo)."""
    return {"status": "alive", "service": "EcommerceBot.Worker"}

@app.get("/health/ready")
async def readiness_check():
    """
    Readiness probe: Valida conectividade ativa com RabbitMQ e Redis
    antes de sinalizar disponibilidade para roteamento de tráfego.
    """
    dependencies = {
        "redis": False,
        "rabbitmq": False
    }

    # 1. Valida Redis
    try:
        dependencies["redis"] = await redis_cache.ping()
    except Exception:
        dependencies["redis"] = False

    # 2. Valida RabbitMQ
    try:
        conn = await get_rabbitmq_connection()
        async with conn:
            dependencies["rabbitmq"] = not conn.is_closed
    except Exception:
        dependencies["rabbitmq"] = False

    all_ready = dependencies["redis"] and dependencies["rabbitmq"]
    status_code = status.HTTP_200_OK if all_ready else status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if all_ready else "degraded",
            "service": "EcommerceBot.Worker",
            "dependencies": dependencies
        }
    )

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)