import uuid
import json
import logging
from fastapi import HTTPException, status
import aio_pika

from app.core.security.crypto import save_tenant_key
from app.features.scraper.schemas import ImportRequestMessage
from app.core.config.rabbitmq import get_rabbitmq_connection

logger = logging.getLogger(__name__)

class AIScraperService:
    @staticmethod
    async def save_credentials(tenant_id: str, provider: str, raw_token: str):
        try:
            await save_tenant_key(tenant_id, provider, raw_token)
        except Exception as e:
            logger.error(f"Falha ao criptografar token para o tenant {tenant_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro interno ao processar e proteger a credencial de segurança."
            )

        logger.info(f"Credencial do provedor '{provider}' salva com sucesso para o Tenant: {tenant_id}")
        return {"status": "success", "message": "Credencial salva e criptografada com sucesso."}

    @staticmethod
    async def enqueue_extraction_task(tenant_id: str, target_url: str, plan: str = "free"):
        generated_product_id = f"req_{uuid.uuid4().hex[:12]}"
        
        message_model = ImportRequestMessage(
            ProductId=generated_product_id,
            TenantId=tenant_id,
            TargetUrl=target_url
        )
        
        try:
            connection = await get_rabbitmq_connection()
            async with connection:
                channel = await connection.channel()
                
                message_body = json.dumps(message_model.model_dump(by_alias=True)).encode()
                routing_key = "ecommerce_prod" if plan in ["premium", "pro", "enterprise"] else "ecommerce_demo"
                
                await channel.default_exchange.publish(
                    aio_pika.Message(
                        body=message_body,
                        content_type="application/json",
                        delivery_mode=aio_pika.DeliveryMode.PERSISTENT
                    ),
                    routing_key=routing_key
                )
                
            logger.info(f"Solicitação de scraping enviada ao RabbitMQ para o Tenant {tenant_id}. URL: {target_url}")
            return {
                "status": "accepted",
                "task_id": generated_product_id,
                "message": "Extração iniciada com sucesso em background."
            }
            
        except Exception as e:
            logger.error(f"Erro ao publicar mensagem de scraping no RabbitMQ para o tenant {tenant_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Não foi possível enfileirar a tarefa de extração no Message Broker."
            )
