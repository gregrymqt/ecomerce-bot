import asyncio
import json
import logging
import aio_pika

from app.core.config.rabbitmq import get_rabbitmq_connection
from app.features.products.repositories import ProductRepository

logger = logging.getLogger(__name__)


class ShopifyWebhookWorker:
    """
    Worker assíncrono dedicado ao consumo e processamento de background de Webhooks da Shopify.
    Consome mensagens da fila 'webhook' do RabbitMQ, filtra eventos da Shopify e executa ações no catálogo.
    """

    SUPPORTED_TOPICS = {
        "products/create",
        "products/update",
        "products/delete",
        "inventory_levels/update",
    }

    def __init__(self, product_repo: ProductRepository | None = None):
        self.product_repo = product_repo or ProductRepository()

    async def handle_event(self, topic: str, shop_domain: str, payload: dict) -> None:
        """
        Processa individualmente cada tópico de webhook da Shopify.
        """
        logger.info(f"⚡ [Shopify Worker] Processando evento '{topic}' da loja '{shop_domain}'")
        
        if topic in ("products/create", "products/update"):
            sku = payload.get("variants", [{}])[0].get("sku") if payload.get("variants") else payload.get("sku")
            shopify_id = str(payload.get("id")) if payload.get("id") else None
            title = payload.get("title")

            logger.info(f"🛒 [Shopify Worker] Atualizando/Sincronizando SKU '{sku}' (ID Shopify: {shopify_id}) | Título: '{title}'")
            # Se aplicável, atualiza o status ou dados do produto no repositório
            if sku and shop_domain:
                tenant_id = shop_domain.split(".")[0]
                await self.product_repo.update_external_ids(
                    tenant_id=tenant_id,
                    sku=sku,
                    shopify_product_id=shopify_id,
                )

        elif topic == "products/delete":
            shopify_id = str(payload.get("id")) if payload.get("id") else None
            logger.info(f"🗑️ [Shopify Worker] Evento de exclusão para o produto ID Shopify '{shopify_id}'")

    async def start_consuming(self, queue_name: str = "shopify_webhook", channel: aio_pika.abc.AbstractChannel | None = None) -> None:
        """
        Inicia o loop assíncrono de consumo de eventos de webhook na fila RabbitMQ.
        """
        try:
            if channel is None:
                connection = await get_rabbitmq_connection()
                channel = await connection.channel()

            await channel.set_qos(prefetch_count=20)
            queue = await channel.get_queue(queue_name)

            logger.info(f"🚀 [ShopifyWebhookWorker] Escutando a fila '{queue_name}'...")

            async with queue.iterator() as queue_iter:
                async for message in queue_iter:
                    try:
                        async with message.process(requeue=False, ignore_processed=True):
                            raw_json = json.loads(message.body.decode("utf-8"))
                            provider = raw_json.get("provider")

                            # Processa apenas mensagens pertencentes ao provedor Shopify
                            if provider == "shopify":
                                topic = raw_json.get("topic", "")
                                shop_domain = raw_json.get("shop_domain", "")
                                payload = raw_json.get("payload", {})

                                await self.handle_event(topic=topic, shop_domain=shop_domain, payload=payload)
                            else:
                                logger.debug(f"ℹ️ [Shopify Worker] Ignorando evento do provedor '{provider}'")
                    except asyncio.CancelledError:
                        raise
                    except Exception as e:
                        logger.error(f"💥 [Shopify Worker] Erro no processamento da mensagem de webhook: {e}", exc_info=True)
                        try:
                            await message.nack(requeue=False)
                        except Exception:
                            pass

        except asyncio.CancelledError:
            logger.info("🛑 [ShopifyWebhookWorker] Worker encerrado graciosamente.")
            raise
        except Exception as e:
            logger.error(f"Erro no loop de consumo do ShopifyWebhookWorker: {e}")
            raise
