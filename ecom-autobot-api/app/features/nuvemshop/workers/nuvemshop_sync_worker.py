import asyncio
import json
import logging
from typing import Optional, Dict, Any
import aio_pika
import httpx

from app.core.config.rabbitmq import get_rabbitmq_connection
from app.features.nuvemshop.repositories import NuvemshopRepository
from app.features.nuvemshop.schemas.product_sync import NuvemshopBulkSyncMessage
from app.features.nuvemshop.services.nuvemshop_rate_limiter import NuvemshopRateLimiter
from app.features.nuvemshop.services.nuvemshop_service import NuvemshopService

logger = logging.getLogger(__name__)


class NuvemshopSyncWorker:
    """
    Worker aio_pika de alta performance dedicado ao consumo da fila 'nuvemshop_bulk_sync'.
    Processa a sincronização assíncrona em lote de produtos para a Nuvemshop com controle de taxa (Rate Limit) por loja.
    """

    def __init__(
        self,
        nuvemshop_repo: Optional[NuvemshopRepository] = None,
    ):
        self.nuvemshop_repo = nuvemshop_repo or NuvemshopRepository()

    async def process_message(self, message: aio_pika.abc.AbstractIncomingMessage) -> None:
        """
        Processa uma única mensagem de sincronização da fila.
        """
        async with message.process(requeue=False):
            try:
                body = message.body.decode("utf-8")
                data: Dict[str, Any] = json.loads(body)
                sync_msg = NuvemshopBulkSyncMessage.model_validate(data)

                tenant_id = sync_msg.tenant_id
                sku = sync_msg.sku
                job_id = sync_msg.job_id
                force_update = sync_msg.force_update
                visibility = sync_msg.visibility

                # 1. Recupera credenciais do tenant para obter o store_id
                creds = await self.nuvemshop_repo.get_credentials(tenant_id)
                if not creds:
                    logger.error(
                        f"❌ [NuvemshopSyncWorker] Credenciais ausentes para o tenant '{tenant_id}'. SKU '{sku}' rejeitado para DLQ."
                    )
                    await self._send_to_dlq(data, reason="Credenciais Nuvemshop ausentes no tenant.")
                    return

                store_id = creds.store_id

                # 2. Respeita a cota e aguarda liberação no Rate Limiter (Token Bucket / Sliding Window)
                await NuvemshopRateLimiter.acquire_ticket(store_id)

                # 3. Executa a sincronização do produto (POST/PUT + Atualização PostgreSQL)
                service = NuvemshopService(tenant_id=tenant_id, nuvemshop_repo=self.nuvemshop_repo)
                result = await service.sync_single_product_sku(
                    sku=sku,
                    force_update=force_update,
                    visibility=visibility,
                )

                product_id = result.get("id", "N/A")
                logger.info(
                    f"✅ [NuvemshopSyncWorker] Tenant {tenant_id} | SKU {sku} sincronizado com sucesso (Nuvemshop ID: {product_id}) | Job: {job_id}"
                )

            except ValueError as val_err:
                logger.error(f"⚠️ [NuvemshopSyncWorker] Erro irrecuperável de validação no SKU '{sync_msg.sku}': {val_err}")
                await self._send_to_dlq(data, reason=str(val_err))

            except httpx.HTTPStatusError as http_err:
                status_code = http_err.response.status_code
                if status_code in (400, 401, 403, 404, 422):
                    logger.error(
                        f"❌ [NuvemshopSyncWorker] Erro 4xx irrecuperável na Nuvemshop [Status {status_code}] para SKU '{sync_msg.sku}': {http_err.response.text}"
                    )
                    await self._send_to_dlq(data, reason=f"Nuvemshop HTTP {status_code}: {http_err.response.text}")
                else:
                    # Erro 5xx ou temporário - permite retentativa
                    logger.warning(
                        f"🔄 [NuvemshopSyncWorker] Erro temporário na Nuvemshop [Status {status_code}] para SKU '{sync_msg.sku}'. Tentativa {sync_msg.attempt}/3."
                    )
                    await self._handle_retry(data, sync_msg, error=str(http_err))

            except Exception as exc:
                logger.error(
                    f"💥 [NuvemshopSyncWorker] Erro de execução ao processar SKU: {exc}", exc_info=True
                )
                await self._handle_retry(data, sync_msg if 'sync_msg' in locals() else None, error=str(exc))

    async def _handle_retry(self, raw_data: Dict[str, Any], sync_msg: Optional[NuvemshopBulkSyncMessage], error: str) -> None:
        """
        Gerencia retentativas para erros temporários de rede/5xx (até 3 tentativas).
        """
        attempt = (sync_msg.attempt if sync_msg else raw_data.get("attempt", 1)) + 1
        if attempt > 3:
            logger.error(f"🛑 [NuvemshopSyncWorker] SKU excede 3 tentativas. Enviando para DLQ. Erro: {error}")
            await self._send_to_dlq(raw_data, reason=f"Excedeu limite de retentativas. Erro: {error}")
            return

        raw_data["attempt"] = attempt
        backoff_seconds = attempt * 2

        logger.info(f"🔁 [NuvemshopSyncWorker] Re-enfileirando mensagem após backoff de {backoff_seconds}s (Tentativa {attempt}/3)...")
        await asyncio.sleep(backoff_seconds)

        try:
            connection = await get_rabbitmq_connection()
            async with connection:
                channel = await connection.channel()
                await channel.default_exchange.publish(
                    aio_pika.Message(
                        body=json.dumps(raw_data).encode("utf-8"),
                        content_type="application/json",
                        delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                    ),
                    routing_key="nuvemshop_bulk_sync",
                )
        except Exception as e:
            logger.error(f"Falha ao re-enfileirar mensagem para retentativa: {e}")

    async def _send_to_dlq(self, payload: Dict[str, Any], reason: str) -> None:
        """
        Publica a mensagem com erro irrecuperável na Dead Letter Exchange 'nuvemshop_dlx' com a routing key 'dlq_nuvemshop_bulk_sync'.
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
                    routing_key="dlq_nuvemshop_bulk_sync",
                )
                logger.info(f"📥 [NuvemshopSyncWorker] Mensagem enviada para DLQ 'dlq_nuvemshop_bulk_sync'. Motivo: {reason}")
        except Exception as e:
            logger.error(f"Falha ao publicar mensagem na DLQ da Nuvemshop: {e}")
        """
        Publica a mensagem com erro irrecuperável na Dead Letter Exchange 'nuvemshop_dlx' com a routing key 'dlq_nuvemshop_bulk_sync'.
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
                    routing_key="dlq_nuvemshop_bulk_sync",
                )
                logger.info(f"📥 [NuvemshopSyncWorker] Mensagem enviada para DLQ 'dlq_nuvemshop_bulk_sync'. Motivo: {reason}")
        except Exception as e:
            logger.error(f"Falha ao publicar mensagem na DLQ da Nuvemshop: {e}")

    async def start_consuming(
        self,
        queue_name: str = "nuvemshop_bulk_sync",
        channel: Optional[aio_pika.abc.AbstractChannel] = None,
    ) -> None:
        """
        Inicia o loop assíncrono de consumo da fila 'nuvemshop_bulk_sync'.
        """
        try:
            if not channel:
                connection = await get_rabbitmq_connection()
                channel = await connection.channel()

            await channel.set_qos(prefetch_count=10)
            queue = await channel.get_queue(queue_name)
            logger.info(f"🚀 [NuvemshopSyncWorker] Iniciado consumo na fila '{queue_name}' (prefetch=10)...")

            async with queue.iterator() as queue_iter:
                async for message in queue_iter:
                    await self.process_message(message)

        except asyncio.CancelledError:
            logger.info("🛑 [NuvemshopSyncWorker] Loop de consumo cancelado.")
        except Exception as err:
            logger.error(f"💥 [NuvemshopSyncWorker] Erro crítico no worker: {err}", exc_info=True)
