import logging
from typing import List
import aio_pika

from app.workers.exporter_worker import ExporterWorker
from app.config.rabbitmq import get_rabbitmq_connection
from app.models.messages import ImportRequestMessage

logger = logging.getLogger(__name__)

class SystemService:
    @staticmethod
    async def process_demo_request(urls: List[str]):
        connection = await get_rabbitmq_connection()
        async with connection:
            channel = await connection.channel()
            
            for url in urls:
                msg_data = ImportRequestMessage(
                    target_url=url,
                    tenant_id="demo_tenant",
                    product_id="demo"
                )
                
                message = aio_pika.Message(
                    body=msg_data.model_dump_json(by_alias=True).encode(),
                    priority=10,
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT
                )
                
                await channel.default_exchange.publish(
                    message,
                    routing_key="ecommerce_demo"
                )

    @staticmethod
    async def process_export(tenant_id: str, platform: str):
        logger.info(f"Processando exportação para tenant: {tenant_id}, plataforma: {platform}")
        exporter = ExporterWorker(tenant_id=tenant_id, platform=platform)
        await exporter.export()