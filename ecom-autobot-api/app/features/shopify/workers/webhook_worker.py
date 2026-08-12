import asyncio
import json
import logging
from typing import Optional
import aio_pika

from app.core.config.rabbitmq import get_rabbitmq_connection
from app.features.products.repositories import ProductRepository
from app.features.shopify.repositories import ShopifyRepository

logger = logging.getLogger(__name__)


class ShopifyWebhookWorker:
    """
    Worker assíncrono dedicado ao consumo e processamento de background de Webhooks da Shopify.
    Consome mensagens da fila 'shopify_webhook' do RabbitMQ, resolve o tenant_id pelo shop_domain
    e sincroniza os estados no PostgreSQL local de forma 100% assíncrona.
    """

    SUPPORTED_TOPICS = {
        "products/create",
        "products/update",
        "products/delete",
        "inventory_levels/update",
        "app/uninstalled",
        "app_uninstalled",
    }

    def __init__(
        self,
        product_repository: Optional[ProductRepository] = None,
        shopify_repository: Optional[ShopifyRepository] = None,
    ):
        self.product_repo = product_repository or ProductRepository()
        self.shopify_repo = shopify_repository or ShopifyRepository()

    async def handle_event(self, topic: str, shop_domain: str, payload: dict) -> None:
        """
        Processa individualmente cada tópico de webhook da Shopify.
        """
        clean_topic = topic.lower().strip()
        logger.info(f"⚡ [Shopify Worker] Processando evento '{clean_topic}' da loja '{shop_domain}'")

        # Resolvendo o tenant_id associado ao domínio da loja
        tenant_id = await self.shopify_repo.get_tenant_by_shop_domain(shop_domain)
        if not tenant_id and shop_domain:
            tenant_id = shop_domain.replace("https://", "").replace("http://", "").split(".")[0].strip().lower()

        if not tenant_id:
            logger.warning(f"⚠️ [Shopify Worker] Tenant não localizado para a loja '{shop_domain}'. Descartando evento.")
            return

        # 1. Tópicos de criação e atualização de produtos
        if clean_topic in ("products/create", "products/update"):
            shopify_id = str(payload.get("id")) if payload.get("id") else None
            title = payload.get("title")
            variants = payload.get("variants", [])

            if not variants and payload.get("sku"):
                variants = [{"sku": payload.get("sku")}]

            logger.info(f"🛒 [Shopify Worker] Processando {len(variants)} variante(s) do produto ID Shopify '{shopify_id}' | Título: '{title}'")

            for var in variants:
                sku = var.get("sku")
                if sku:
                    await self.product_repo.update_external_ids(
                        tenant_id=tenant_id,
                        sku=sku,
                        shopify_product_id=shopify_id,
                    )
                    logger.info(f"✅ [Shopify Worker] Produto SKU '{sku}' atualizado com shopify_product_id '{shopify_id}' para tenant '{tenant_id}'.")

        # 2. Tópico de exclusão de produtos
        elif clean_topic == "products/delete":
            shopify_id = str(payload.get("id")) if payload.get("id") else None
            if shopify_id:
                await self.product_repo.unlink_shopify_product(
                    tenant_id=tenant_id,
                    shopify_product_id=shopify_id,
                )
                logger.info(f"🗑️ [Shopify Worker] Desvinculado produto ID Shopify '{shopify_id}' para tenant '{tenant_id}'.")

        # 3. Tópico de atualização de estoque
        elif clean_topic in ("inventory_levels/update", "inventory_levels_update"):
            inventory_item_id = payload.get("inventory_item_id")
            available = payload.get("available")
            logger.info(f"📦 [Shopify Worker] Estoque atualizado no Shopify: item '{inventory_item_id}' -> saldo disponível: {available}")

        # 4. Tópico de desinstalação do aplicativo
        elif clean_topic in ("app/uninstalled", "app_uninstalled"):
            await self.shopify_repo.deactivate_integration(shop_domain)
            logger.info(f"🛑 [Shopify Worker] Aplicativo desinstalado da loja '{shop_domain}'. Integração inativada.")

    async def start_consuming(
        self,
        queue_name: str = "shopify_webhook",
        channel: aio_pika.abc.AbstractChannel | None = None,
    ) -> None:
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
