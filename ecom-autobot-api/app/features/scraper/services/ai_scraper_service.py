from datetime import datetime, timezone
import json
import logging
import uuid
import aio_pika
from fastapi import HTTPException, status

from app.core.config.rabbitmq import get_rabbitmq_connection
from app.core.config.redis_db import redis_cache
from app.core.security.crypto import save_tenant_key
from app.features.scraper.schemas import ImportRequestMessage

logger = logging.getLogger(__name__)

PLAN_QUOTAS = {
    "free": 10,
    "pro": 500,
    "premium": 500,
    "enterprise": 5000,
}


class AIScraperService:
    @staticmethod
    async def check_and_increment_daily_quota(tenant_id: str, plan: str = "free") -> None:
        """
        Verifica e incrementa a cota diária de extração do Tenant com base em seu plano.
        """
        plan_clean = (plan or "free").lower()
        quota_limit = PLAN_QUOTAS.get(plan_clean, 10)

        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        quota_key = f"quota:tenant:{tenant_id}:date:{today_str}"

        try:
            if redis_cache.redis_client:
                current_usage = await redis_cache.incr(quota_key)
                if current_usage == 1:
                    await redis_cache.expire(quota_key, 86400 * 2)

                if current_usage > quota_limit:
                    logger.warning(
                        f"[AIScraperService] Cota diária de extração excedida para Tenant '{tenant_id}' (Plano: {plan_clean}). "
                        f"Uso atual: {current_usage}, Limite: {quota_limit}"
                    )
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Daily extraction quota reached for your plan.",
                    )
        except HTTPException:
            raise
        except Exception as err:
            logger.error(f"[AIScraperService] Erro ao verificar cota no Redis para tenant {tenant_id}: {err}")

    @staticmethod
    async def save_credentials(tenant_id: str, provider: str, raw_token: str):
        try:
            await save_tenant_key(tenant_id, provider, raw_token)
        except Exception as e:
            logger.error(f"Falha ao criptografar token para o tenant {tenant_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro interno ao processar e proteger a credencial de segurança.",
            )

        logger.info(f"Credencial do provedor '{provider}' salva com sucesso para o Tenant: {tenant_id}")
        return {"status": "success", "message": "Credencial salva e criptografada com sucesso."}

    @staticmethod
    async def enqueue_extraction_task(
        tenant_id: str, 
        target_url: str, 
        plan: str = "free",
        channel: aio_pika.abc.AbstractChannel = None  # Reutilização de canal injetado
    ):
        # 0. Valida e incrementa cota diária
        await AIScraperService.check_and_increment_daily_quota(tenant_id, plan)

        generated_product_id = f"req_{uuid.uuid4().hex[:12]}"

        message_model = ImportRequestMessage(
            ProductId=generated_product_id,
            TenantId=tenant_id,
            TargetUrl=target_url,
        )

        try:
            # Reutiliza o canal passado pela rota ou abre uma conexão de fallback
            if channel is None:
                connection = await get_rabbitmq_connection()
                channel = await connection.channel()

            message_body = json.dumps(message_model.model_dump(by_alias=True)).encode()

            # 1. Nomes ajustados de acordo com a topologia de 7 filas
            routing_key = "ecommerce" if plan in ["premium", "pro", "enterprise"] else "demo_ecommerce"

            # 2. Publicação otimizada com headers e message_id para rastreabilidade
            await channel.default_exchange.publish(
                aio_pika.Message(
                    body=message_body,
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                    message_id=generated_product_id,
                    headers={
                        "x-tenant-id": tenant_id,
                        "x-user-plan": plan,
                    }
                ),
                routing_key=routing_key,
            )

            logger.info(f"Solicitação de scraping enfileirada na fila '{routing_key}' para Tenant {tenant_id}. ID: {generated_product_id}")
            return {
                "status": "accepted",
                "task_id": generated_product_id,
                "message": "Extração iniciada com sucesso em background.",
            }

        except Exception as e:
            logger.error(f"Erro ao publicar mensagem de scraping no RabbitMQ para o tenant {tenant_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Não foi possível enfileirar a tarefa de extração no Message Broker.",
            )