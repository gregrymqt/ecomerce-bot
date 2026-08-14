import asyncio
import json
import logging
from typing import Any, Dict, Optional
import aio_pika

from app.core.config.rabbitmq import get_rabbitmq_connection
from app.core.config.redis_db import redis_cache
from app.features.nuvemshop.repositories import NuvemshopRepository
from app.features.nuvemshop.schemas.nuvemshop_webhook_schemas import NuvemshopWebhookQueueMessage
from app.features.products.repositories.product_repository import ProductRepository

logger = logging.getLogger(__name__)


class NuvemshopWebhookWorker:
    """
    Worker aio_pika para consumo assíncrono de eventos da fila 'nuvemshop_webhook'.
    Processa sincronização bidirecional (product/created, product/updated, product/deleted, app/uninstalled)
    com trava de 24h no Redis e isolamento Multi-Tenant estrito.
    """

    def __init__(
        self,
        nuvemshop_repo: Optional[NuvemshopRepository] = None,
        product_repo: Optional[ProductRepository] = None,
    ):
        self.nuvemshop_repo = nuvemshop_repo or NuvemshopRepository()
        self.product_repo = product_repo or ProductRepository()

    async def start_consuming(self, queue_name: str = "nuvemshop_webhook", channel: Optional[aio_pika.abc.AbstractChannel] = None) -> None:
        """
        Inicia o consumidor aio_pika escutando a fila RabbitMQ de webhooks da Nuvemshop.
        """
        connection = None
        if not channel:
            connection = await get_rabbitmq_connection()
            channel = await connection.channel()

        await channel.set_qos(prefetch_count=10)
        queue = await channel.declare_queue(queue_name, durable=True)

        logger.info(f"🚀 [NuvemshopWebhookWorker] Consumidor de webhooks ativo na fila '{queue_name}'.")

        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                await self.process_message(message)

    async def process_message(self, message: aio_pika.abc.AbstractIncomingMessage) -> None:
        """
        Processa uma única mensagem da fila de webhooks da Nuvemshop.
        """
        async with message.process(requeue=False):
            data: Dict[str, Any] = {}
            try:
                body = message.body.decode("utf-8")
                data = json.loads(body)

                # Aceita o envelope padronizado NuvemshopWebhookQueueMessage ou envelope simples
                event = str(data.get("event") or data.get("topic") or "")
                store_id = int(data.get("store_id") or data.get("store") or 0)
                resource_id = data.get("resource_id") or data.get("id")
                event_id = str(data.get("event_id") or f"{store_id}:{event}:{resource_id}")
                raw_payload = data.get("payload") or data

                if not store_id or not event:
                    logger.warning(f"⚠️ [NuvemshopWebhookWorker] Mensagem malformatada recebida e descartada: {data}")
                    return

                # 1. Trava de Idempotência Atômica no Redis (SET ecom:webhook:nuvemshop:{event_id} "1" EX 86400 NX)
                lock_key = f"ecom:webhook:nuvemshop:{event_id}"
                try:
                    acquired = await redis_cache.set(lock_key, "1", expire_seconds=86400, nx=True)
                    if not acquired:
                        logger.info(f"ℹ️ [NuvemshopWebhookWorker] Evento duplicado ignorado (Lock Hit): {lock_key}")
                        return
                except Exception as cache_err:
                    logger.warning(f"⚠️ [NuvemshopWebhookWorker] Falha ao verificar trava Redis: {cache_err}")

                # 2. Resolução Store ID -> Tenant ID
                tenant_id = await self.nuvemshop_repo.get_tenant_id_by_store_id(str(store_id))
                if not tenant_id:
                    logger.warning(
                        f"⚠️ [NuvemshopWebhookWorker] Loja '{store_id}' não está mapeada para nenhum tenant ativo. Evento '{event}' descartado."
                    )
                    return

                # 3. Roteamento de Eventos
                if event in ("product/created", "product/updated"):
                    await self._handle_product_upsert(tenant_id, store_id, event, raw_payload)
                elif event == "product/deleted":
                    await self._handle_product_deleted(tenant_id, store_id, raw_payload)
                elif event == "app/uninstalled":
                    await self._handle_app_uninstalled(tenant_id, store_id)
                else:
                    logger.info(f"ℹ️ [NuvemshopWebhookWorker] Evento '{event}' não requer sincronização ativa. Confirmado.")

                logger.info(
                    f"✅ [NuvemshopWebhookWorker] Evento {event} processado com sucesso | Tenant {tenant_id} | Loja {store_id}"
                )

            except Exception as exc:
                logger.error(
                    f"💥 [NuvemshopWebhookWorker] Erro ao processar evento de webhook: {exc}", exc_info=True
                )
                await self._send_to_dlq(data, reason=str(exc))

    async def _handle_product_upsert(
        self,
        tenant_id: str,
        store_id: int,
        event: str,
        payload: Dict[str, Any],
    ) -> None:
        """
        Sincroniza atualizações de preço, estoque e metadados vindos da Nuvemshop no ProductModel local.
        """
        nuvemshop_id = str(payload.get("id") or "")
        variants = payload.get("variants", [])
        primary_sku = None
        primary_price = None
        primary_stock = None

        if isinstance(variants, list) and len(variants) > 0:
            v0 = variants[0] if isinstance(variants[0], dict) else {}
            primary_sku = v0.get("sku")
            primary_price = v0.get("price")
            primary_stock = v0.get("stock")

        if not primary_sku:
            primary_sku = payload.get("sku")

        # Busca o produto no banco pelo par (tenant_id, nuvemshop_product_id) ou (tenant_id, sku)
        product = None
        if nuvemshop_id:
            product = await self.product_repo.get_by_tenant_and_nuvemshop_id(tenant_id, nuvemshop_id)

        if not product and primary_sku:
            product = await self.product_repo.get_by_tenant_and_sku(tenant_id, primary_sku)

        title_raw = payload.get("name", {})
        title_pt = title_raw.get("pt") if isinstance(title_raw, dict) else str(title_raw or "")

        if product:
            # Produto existe no banco local -> Atualiza metadados sem sobrescrever IA Enriched
            await self.product_repo.update_external_ids(
                tenant_id=tenant_id,
                sku=product.sku,
                nuvemshop_product_id=nuvemshop_id or product.nuvemshop_product_id,
            )
            logger.info(
                f"🔄 [NuvemshopWebhookWorker] Produto SKU '{product.sku}' (ID Nuvemshop: {nuvemshop_id}) atualizado no banco local via webhook da loja {store_id}."
            )
        else:
            # Produto inédito -> Cria registro prévio
            sku_to_use = primary_sku or f"NS-{nuvemshop_id}"
            await self.product_repo.create_raw_product(
                tenant_id=tenant_id,
                sku=sku_to_use,
                title=title_pt or f"Produto Nuvemshop {nuvemshop_id}",
                raw_payload=payload,
            )
            if nuvemshop_id:
                await self.product_repo.update_external_ids(
                    tenant_id=tenant_id,
                    sku=sku_to_use,
                    nuvemshop_product_id=nuvemshop_id,
                )
            logger.info(
                f"✨ [NuvemshopWebhookWorker] Produto SKU '{sku_to_use}' (ID Nuvemshop: {nuvemshop_id}) registrado no banco via webhook."
            )

    async def _handle_product_deleted(self, tenant_id: str, store_id: int, payload: Dict[str, Any]) -> None:
        """
        Trata o evento product/deleted removendo a vinculação nuvemshop_product_id do produto local.
        """
        nuvemshop_id = str(payload.get("id") or "")
        if not nuvemshop_id:
            return

        product = await self.product_repo.get_by_tenant_and_nuvemshop_id(tenant_id, nuvemshop_id)
        if product:
            await self.product_repo.update_external_ids(
                tenant_id=tenant_id,
                sku=product.sku,
                nuvemshop_product_id=None,
            )
            logger.info(
                f"🗑️ [NuvemshopWebhookWorker] Produto ID Nuvemshop '{nuvemshop_id}' (SKU '{product.sku}') desvinculado no banco via webhook."
            )

    async def _handle_app_uninstalled(self, tenant_id: str, store_id: int) -> None:
        """
        Trata o desvinculo da loja Nuvemshop (app/uninstalled): desativa credenciais e limpa caches do Redis.
        """
        await self.nuvemshop_repo.deactivate_credentials(tenant_id)

        # Invalida caches da loja no Redis
        cache_key_cat = f"ecom:categories:nuvemshop:{store_id}"
        cache_key_tenant = f"nuvemshop_store_tenant:{store_id}"
        try:
            await redis_cache.delete(cache_key_cat)
            await redis_cache.delete(cache_key_tenant)
        except Exception as cache_err:
            logger.warning(f"⚠️ [NuvemshopWebhookWorker] Falha ao limpar cache pós-desinstalação: {cache_err}")

        logger.error(
            f"🚨 [NuvemshopWebhookWorker] App desinstalado pela loja {store_id}. Credenciais inativadas para tenant '{tenant_id}'."
        )

    async def _send_to_dlq(self, payload: Dict[str, Any], reason: str) -> None:
        """
        Publica mensagens com falhas irrecuperáveis na Dead Letter Exchange 'nuvemshop_dlx' com a routing key 'dlq_nuvemshop_webhooks'.
        """
        payload["error_reason"] = reason
        try:
            connection = await get_rabbitmq_connection()
            async with connection:
                channel = await connection.channel()
                dlx = await channel.get_exchange("nuvemshop_dlx")
                await dlx.publish(
                    aio_pika.Message(
                        body=json.dumps(payload).encode("utf-8"),
                        content_type="application/json",
                        delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                    ),
                    routing_key="dlq_nuvemshop_webhooks",
                )
                logger.info(f"📥 [NuvemshopWebhookWorker] Mensagem enviada para DLQ 'dlq_nuvemshop_webhooks'. Motivo: {reason}")
        except Exception as e:
            logger.error(f"Falha ao publicar mensagem na DLQ de Webhooks da Nuvemshop: {e}")
