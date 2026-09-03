import asyncio
import json
import logging
from typing import Dict, Any
import aio_pika

from app.core.config.settings import settings
from app.core.config.rabbitmq import (
    QUEUE_ANALYTICS_ML,
    QUEUE_ANALYTICS_PROCESSED,
    ANALYTICS_ML_QUEUE_ARGS
)
from .rfm_segmentation import RFMSegmentation
from .churn_predictor import ChurnPredictor
from .ltv_forecaster import LTVForecaster
from .token_capacity_forecaster import TokenCapacityForecaster

logger = logging.getLogger(__name__)

QUEUE_ML_INPUT = QUEUE_ANALYTICS_ML
QUEUE_ML_OUTPUT = QUEUE_ANALYTICS_PROCESSED

class AnalyticsMLEngine:
    def __init__(self):
        self.rfm_model = RFMSegmentation()
        self.churn_model = ChurnPredictor()
        self.ltv_model = LTVForecaster()
        self.token_forecaster = TokenCapacityForecaster()

    def process_analytics_sync(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execução síncrona dos modelos de ML (executada em thread separada pelo worker).
        """
        tenant_id = payload.get("tenantId") or payload.get("tenant_id")
        job_type = (payload.get("jobType") or payload.get("job_type") or "FULL_ANALYTICS").upper()
        transactions = payload.get("transactions", [])
        usage_history = payload.get("usageHistory") or payload.get("usage_history") or []
        current_balances = payload.get("currentBalances") or payload.get("current_balances") or {}
        forecast_days = int(payload.get("forecastDays") or payload.get("forecast_days") or 30)

        logger.info(f"📊 [ML Engine] Processando job={job_type} para tenant={tenant_id}.")

        results = {
            "tenantId": tenant_id,
            "jobType": job_type,
            "status": "SUCCESS",
            "rfm": None,
            "churn": None,
            "ltv": None,
            "tokenCapacity": None
        }

        try:
            if job_type in ["TOKEN_CAPACITY_FORECAST"]:
                results["tokenCapacity"] = self.token_forecaster.forecast_capacity(
                    usage_history=usage_history,
                    current_balances=current_balances,
                    forecast_days=forecast_days
                )

            if job_type in ["RFM_SEGMENTATION", "FULL_ANALYTICS"]:
                results["rfm"] = self.rfm_model.segment_customers(transactions)

            if job_type in ["CHURN_PREDICTION", "FULL_ANALYTICS"]:
                results["churn"] = self.churn_model.predict_churn(transactions)

            if job_type in ["LTV_FORECAST", "FULL_ANALYTICS"]:
                results["ltv"] = self.ltv_model.forecast_ltv(transactions)

        except Exception as e:
            logger.error(f"Erro no processamento de Machine Learning: {e}", exc_info=True)
            results["status"] = "FAILED"
            results["errorMessage"] = str(e)

        return results


async def _process_ml_message(message: aio_pika.IncomingMessage, channel: aio_pika.Channel, engine: AnalyticsMLEngine):
    async with message.process():
        body_text = message.body.decode("utf-8")
        try:
            payload = json.loads(body_text)
        except Exception as e:
            logger.error(f"Falha ao decodificar JSON em {QUEUE_ML_INPUT}: {e}")
            return

        tenant_id = payload.get("tenantId") or payload.get("tenant_id")
        if not tenant_id:
            logger.warning("Mensagem de ML recebida sem tenantId.")
            return

        # Executa em thread assíncrona para não travar o loop de I/O do RabbitMQ
        result_data = await asyncio.to_thread(engine.process_analytics_sync, payload)

        # Publica o resultado no RabbitMQ
        try:
            await channel.default_exchange.publish(
                aio_pika.Message(
                    body=json.dumps(result_data).encode("utf-8"),
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT
                ),
                routing_key=QUEUE_ML_OUTPUT
            )
            logger.info(f"✅ Resultados de ML publicados em '{QUEUE_ML_OUTPUT}' para tenant {tenant_id}.")
        except Exception as pub_err:
            logger.error(f"Erro ao publicar resultados de ML: {pub_err}")


async def consume_ml_queue():
    """
    Worker assíncrono para consumo da fila analytics_ml_queue.
    """
    logger.info(f"📡 Inicializando MLWorker conectado a {settings.RABBITMQ_URL}...")
    engine = AnalyticsMLEngine()

    while True:
        try:
            connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
            async with connection:
                channel = await connection.channel()
                await channel.set_qos(prefetch_count=2)

                # Declaração das filas de ML com argumentos canônicos idênticos à topologia
                input_q = await channel.declare_queue(
                    QUEUE_ML_INPUT,
                    durable=True,
                    arguments=ANALYTICS_ML_QUEUE_ARGS
                )
                await channel.declare_queue(QUEUE_ML_OUTPUT, durable=True)

                logger.info(f"🚀 MLWorker operacional e escutando em '{QUEUE_ML_INPUT}'...")

                async for message in input_q:
                    await _process_ml_message(message, channel, engine)

        except asyncio.CancelledError:
            logger.info("🛑 MLWorker encerrado graciosamente.")
            break
        except Exception as e:
            logger.warning(f"⚠️ Erro de conexão RabbitMQ no MLWorker ({e}). Reconectando em 5s...")
            await asyncio.sleep(5)
