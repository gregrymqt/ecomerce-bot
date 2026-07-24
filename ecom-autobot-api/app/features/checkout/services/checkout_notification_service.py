import logging
from typing import Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import AsyncSessionLocal
from app.features.checkout.domain.models import OrderModel
from app.features.checkout.infrastructure.client import MercadoPagoOrderClient
from app.features.checkout.repositories import OrderRepository
from app.features.checkout.services.checkout_service import CheckoutService
from app.features.mercadopago.schemas import (
    BaseNotificationHandler,
    MercadoPagoNotificationPayload,
)

logger = logging.getLogger(__name__)


class CheckoutNotificationService(BaseNotificationHandler):
    """
    Handler assíncrono para consumir notificações de Orders do Mercado Pago
    despachadas pelo Worker do RabbitMQ.

    Suporta injeção de repositório, cliente ou sessão via AsyncSessionLocal com a helper `_get_session()`.
    """

    def __init__(
        self,
        repository: Optional[OrderRepository] = None,
        client: Optional[MercadoPagoOrderClient] = None,
        session: Optional[AsyncSession] = None,
    ):
        self.session = session
        self.repository = repository or OrderRepository(session=session)
        self.client = client or MercadoPagoOrderClient()

    async def _get_session(self) -> Tuple[AsyncSession, bool]:
        """
        Retorna a sessão injetada ou cria uma nova sessão AsyncSessionLocal.
        Retorna uma tupla (session, owned) indicando se a sessão deve ser fechada localmente.
        """
        if self.session is not None:
            return self.session, False
        session = AsyncSessionLocal()
        return session, True

    async def handle(self, payload: MercadoPagoNotificationPayload) -> None:
        mp_order_id = payload.effective_resource_id
        if not mp_order_id:
            logger.error("[CheckoutNotification] Notificação recebida sem 'effective_resource_id' válido.")
            return

        logger.info(f"🛒 [CheckoutNotification] Processando evento de Webhook para Order MP #{mp_order_id}...")

        session, owned = await self._get_session()
        try:
            # 1. Busca localmente pelo mp_order_id para identificar o tenant_id
            stmt = select(OrderModel).where(OrderModel.mp_order_id == mp_order_id)
            result = await session.execute(stmt)
            local_order: Optional[OrderModel] = result.scalars().first()

            # 2. Fallback: Se não encontrou pelo mp_order_id, consulta o MP via self.client para resgatar o external_reference
            if not local_order:
                try:
                    mp_order_data = await self.client.get_order_by_id(mp_order_id)
                    if mp_order_data and mp_order_data.external_reference:
                        stmt = select(OrderModel).where(
                            OrderModel.external_reference == mp_order_data.external_reference
                        )
                        result = await session.execute(stmt)
                        local_order = result.scalars().first()
                except Exception as exc:
                    logger.error(
                        f"[CheckoutNotification] Falha ao consultar API do Mercado Pago para order #{mp_order_id}: {exc}"
                    )

            if not local_order:
                logger.warning(
                    f"[CheckoutNotification] Order MP #{mp_order_id} não encontrada na base local de nenhum tenant."
                )
                return

            # 3. Executa a sincronização de estado com garantia Zero Trust
            checkout_service = CheckoutService(session)
            updated_order = await checkout_service.sync_order_status_from_mp(
                tenant_id=local_order.tenant_id,
                mp_order_id=mp_order_id,
            )

            if updated_order:
                logger.info(
                    f"✅ [CheckoutNotification] Order local '{updated_order.id}' "
                    f"(Tenant: '{updated_order.tenant_id}') sincronizada com sucesso | Status: '{updated_order.status}'"
                )
        finally:
            if owned:
                await session.close()