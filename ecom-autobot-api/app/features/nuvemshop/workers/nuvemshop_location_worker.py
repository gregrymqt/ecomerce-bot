import asyncio
import json
import logging
from typing import Optional
import aio_pika

from app.core.config.rabbitmq import get_rabbitmq_connection
from app.features.nuvemshop.repositories import NuvemshopRepository
from app.features.nuvemshop.services import NuvemshopStockService

logger = logging.getLogger(__name__)


class NuvemshopLocationWorker:
    """
    Worker de Background dedicado ao consumo de eventos de webhook da família 'location/*' da Nuvemshop.
    Consome mensagens da fila 'nuvemshop_webhook' do RabbitMQ e sincroniza depósitos e estoques no banco local.
    """

    SUPPORTED_EVENTS = {
        "location/created",
        "location/updated",
        "location/deleted",
    }

    def __init__(
        self,
        nuvemshop_repo: Optional[NuvemshopRepository] = None,
    ):
        self.nuvemshop_repo = nuvemshop_repo or NuvemshopRepository()

    async def handle_event(self, event: str, store_id: str, payload: dict) -> None:
        """
        Processa eventos da família location/* da Nuvemshop.
        """
        clean_event = event.lower().strip()
        logger.info(f"⚡ [Nuvemshop Location Worker] Processando evento '{clean_event}' da loja '{store_id}'")

        tenant_id = await self.nuvemshop_repo.get_credentials(store_id)
        tenant_id_str = store_id if tenant_id else store_id

        if not tenant_id_str:
            logger.warning(f"⚠️ [Nuvemshop Location Worker] Tenant não localizado para a loja '{store_id}'. Descartando evento.")
            return

        stock_service = NuvemshopStockService(tenant_id=tenant_id_str, nuvemshop_repo=self.nuvemshop_repo)

        # 1. Eventos de criação e atualização de depósito/localização
        if clean_event in ("location/created", "location/updated"):
            location_id = str(payload.get("id", payload.get("location_id", "")))
            logger.info(f"🏬 [Nuvemshop Location Worker] Sincronizando depósito '{location_id}' do tenant '{tenant_id_str}' (Evento: {clean_event})")

            try:
                locations = await stock_service.get_tenant_locations()
                logger.info(f"✅ [Nuvemshop Location Worker] {len(locations)} depósito(s) consultados com sucesso para tenant '{tenant_id_str}'.")
            except Exception as e:
                logger.error(f"❌ [Nuvemshop Location Worker] Falha ao sincronizar depósito '{location_id}': {e}")
                raise e

        # 2. Evento de remoção/exclusão de depósito
        elif clean_event == "location/deleted":
            location_id = str(payload.get("id", payload.get("location_id", "")))
            logger.info(f"🗑️ [Nuvemshop Location Worker] Depósito '{location_id}' removido na Nuvemshop para o tenant '{tenant_id_str}'.")

    async def start_consuming(
        self,
        queue_name: str = "nuvemshop_webhook",
        channel: aio_pika.abc.AbstractChannel | None = None,
    ) -> None:
        """
        Inicia o loop assíncrono de consumo da fila 'nuvemshop_webhook'.
        """
        try:
            if not channel:
                connection = await get_rabbitmq_connection()
                channel = await connection.channel()
                await channel.set_qos(prefetch_count=10)

            queue = await channel.get_queue(queue_name)
            logger.info(f"🚀 [Nuvemshop Location Worker] Iniciado consumo na fila '{queue_name}'...")

            async with queue.iterator() as queue_iter:
                async for message in queue_iter:
                    async with message.process(requeue=False):
                        try:
                            data = json.loads(message.body.decode("utf-8"))
                            event = data.get("event", "")
                            store_id = data.get("store_id", "")
                            payload = data.get("payload", {})

                            if event in self.SUPPORTED_EVENTS or event.startswith("location/"):
                                await self.handle_event(event=event, store_id=store_id, payload=payload)
                            else:
                                logger.debug(f"[Nuvemshop Location Worker] Evento '{event}' não pertence a location/*. Ignorado.")
                        except Exception as e:
                            logger.error(f"❌ [Nuvemshop Location Worker] Erro no processamento da mensagem: {e}", exc_info=True)
                            raise e
        except asyncio.CancelledError:
            logger.info("🛑 [Nuvemshop Location Worker] Loop de consumo cancelado.")
        except Exception as err:
            logger.error(f"💥 [Nuvemshop Location Worker] Erro crítico no worker: {err}")
