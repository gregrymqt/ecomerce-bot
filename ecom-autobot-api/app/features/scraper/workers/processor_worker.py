import json
import asyncio
from typing import Optional, Tuple
import aio_pika
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import AsyncSessionLocal
from app.core.config.rabbitmq import get_rabbitmq_connection
from app.core.shared.logger import get_logger
from app.features.scraper.services.processor_service import ProcessorService

logger = get_logger("ProcessorWorker")


class ProcessorWorker:
    """
    Worker de Background responsável pelo consumo de tarefas da fila RabbitMQ ('llm')
    e pela recuperação/reset de jobs travados no banco de dados.
    """

    def __init__(self, repo, llm=None, session: Optional[AsyncSession] = None):
        self.repo = repo
        self.llm = llm
        self.session = session
        self.processor_service = ProcessorService(repo=repo, llm=llm, session=session, worker=self)

    async def _get_session(self) -> Tuple[AsyncSession, bool]:
        if self.session is not None:
            return self.session, False
        return AsyncSessionLocal(), True

    async def _process_with_retry(self, product, current_llm=None):
        """Delegador para o ProcessorService para manter 100% de compatibilidade retroativa com testes unitários."""
        return await self.processor_service._process_with_retry_internal(product, current_llm=current_llm)

    async def _process_llm_task(self, tenant_id: str, sku: str, queue_name: str) -> None:
        """Delegador para o ProcessorService para manter 100% de compatibilidade retroativa com testes unitários."""
        return await self.processor_service.process_llm_task(tenant_id, sku, queue_name)

    async def reset_stuck_processing_jobs(self, timeout_minutes: int = 10) -> int:
        """
        Resgata e reseta produtos travados no estado 'Processing' há mais de timeout_minutes minutos.
        Delegado para o ProductRepository.
        """
        return await self.repo.reset_stuck_processing_jobs(timeout_minutes=timeout_minutes)

    async def start_consuming(self, queue_name: str = "llm", channel: aio_pika.abc.AbstractChannel | None = None) -> None:
        """
        Inicia o consumo assíncrono de tarefas de enriquecimento LLM via RabbitMQ.
        """
        try:
            await self.reset_stuck_processing_jobs(timeout_minutes=10)
            if channel is None:
                connection = await get_rabbitmq_connection()
                channel = await connection.channel()

            await channel.set_qos(prefetch_count=2)
            queue = await channel.get_queue(queue_name)

            logger.info(f"ProcessorWorker aguardando tarefas de LLM na fila '{queue_name}'...")

            async with queue.iterator() as queue_iter:
                async for message in queue_iter:
                    try:
                        async with message.process(requeue=False, ignore_processed=True):
                            payload = json.loads(message.body.decode())
                            tenant_id = payload.get("tenant_id")
                            sku = payload.get("sku")

                            if not tenant_id or not sku:
                                raise ValueError("Payload inválido. Necessário 'tenant_id' e 'sku'.")

                            await self.processor_service.process_llm_task(tenant_id, sku, queue_name)

                    except asyncio.CancelledError:
                        raise
                    except Exception as process_err:
                        logger.error(f"Erro ao processar LLM na fila {queue_name}: {process_err}", exc_info=True)
                        try:
                            await message.nack(requeue=False)
                        except Exception:
                            pass

        except asyncio.CancelledError:
            logger.info("🛑 [ProcessorWorker] Task do worker encerrada graciosamente.")
            raise
        except Exception as e:
            logger.error(f"Erro assíncrono na conexão/consumo do RabbitMQ no ProcessorWorker: {e}")


if __name__ == "__main__":
    import asyncio
    from app.features.products.repositories import ProductRepository

    async def main():
        repository = ProductRepository()
        worker = ProcessorWorker(repository, llm=None)
        await worker.start_consuming()

    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("🛑 Worker interrompido manualmente.")