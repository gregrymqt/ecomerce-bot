import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from app.features.checkout.infrastructure.client import MercadoPagoOrderClient

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.checkout.domain.enums import OrderStatus, OrderStatusDetail
from app.features.checkout.domain.exceptions import OrderNotFoundError
from app.features.checkout.domain.models import OrderModel
from app.features.checkout.repositories.order_repository import OrderRepository

logger = logging.getLogger(__name__)


def _get_order_client():
    from app.features.checkout.infrastructure.client import MercadoPagoOrderClient
    return MercadoPagoOrderClient()


class OrderService:
    """
    Serviço de Domínio responsável por consultas, busca e sincronização de status de pedidos.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.order_repo = OrderRepository(session)

    async def get_order_by_id(self, tenant_id: str, order_id: str) -> Optional[OrderModel]:
        """Busca um pedido por ID e Tenant."""
        return await self.order_repo.get_by_id(tenant_id=tenant_id, order_id=order_id)

    async def sync_order_status_from_mp(
        self, tenant_id: str, mp_order_id: str
    ) -> Optional[OrderModel]:
        """
        Consulta o Mercado Pago e atualiza o estado real do pedido no Banco e Cache Redis.
        Essencial para o manipulador de Webhooks e Polling.
        """
        async with _get_order_client() as mp_client:
            mp_order = await mp_client.get_order_by_id(order_id=mp_order_id)

        local_order = await self.order_repo.get_by_mp_order_id(tenant_id, mp_order_id)
        if not local_order and mp_order.external_reference:
            local_order = await self.order_repo.get_by_external_reference(
                tenant_id, mp_order.external_reference
            )

        if not local_order:
            logger.error(
                f"[OrderService] Order MP {mp_order_id} recebida no webhook não encontrada localmente."
            )
            raise OrderNotFoundError(mp_order_id)

        new_status = OrderStatus(mp_order.status.value)
        new_status_detail = OrderStatusDetail(mp_order.status_detail.value) if mp_order.status_detail else None
        new_total_paid = Decimal(mp_order.total_paid_amount or "0.00")

        if (
            local_order.status == new_status
            and local_order.status_detail == new_status_detail
            and local_order.total_paid_amount == new_total_paid
        ):
            logger.info(
                f"[OrderService] Order {local_order.id} (MP: {mp_order_id}) já possui o status '{new_status}'. Nenhuma alteração relacional necessária (Idempotent State Hit)."
            )
            return local_order

        local_order.status = new_status
        if new_status_detail:
            local_order.status_detail = new_status_detail

        local_order.total_paid_amount = new_total_paid
        local_order.raw_mp_response = mp_order.model_dump(mode="json")
        local_order.updated_at = datetime.now(timezone.utc)

        await self.order_repo.update(local_order)
        await self.session.commit()

        if new_status == OrderStatus.PROCESSED:
            await self._fulfill_wallet_recharge_if_needed(local_order)

        logger.info(
            f"[OrderService] Order {local_order.id} sincronizada com sucesso. Status='{local_order.status}'"
        )
        return local_order

    async def _fulfill_wallet_recharge_if_needed(self, order: OrderModel) -> None:
        """
        Verifica se a order aprovada é uma recarga de créditos da carteira pré-paga
        e credita os pontos no saldo do tenant.
        """
        try:
            credits_to_add = 0
            if order.external_reference and order.external_reference.startswith("{"):
                try:
                    import json
                    ref_data = json.loads(order.external_reference)
                    if isinstance(ref_data, dict) and "credits" in ref_data:
                        credits_to_add = int(ref_data["credits"])
                except Exception:
                    pass

            if credits_to_add == 0 and order.items:
                for item in order.items:
                    if item.external_code and item.external_code.startswith("pkg_"):
                        try:
                            credits_to_add += int(item.external_code.replace("pkg_", ""))
                        except Exception:
                            pass

            if credits_to_add > 0:
                logger.info(
                    f"[OrderService] Creditando {credits_to_add} créditos para tenant '{order.tenant_id}' (Order: '{order.id}', MP: '{order.mp_order_id}')"
                )
                from app.features.wallet.repositories import WalletRepository
                from app.features.wallet.services import CreditService

                credit_service = CreditService(WalletRepository(self.session))
                updated_wallet = await credit_service.add_credits(
                    tenant_id=order.tenant_id,
                    amount=credits_to_add,
                    description=f"Recarga via Mercado Pago Order #{order.mp_order_id or order.id}",
                    external_payment_id=order.mp_order_id or order.id,
                )

                from app.features.emails.services.email_dispatcher import email_dispatcher
                await email_dispatcher.publish_email_event(
                    event_name="RECHARGE_CONFIRMED",
                    recipient_email=order.payer_email,
                    tenant_id=order.tenant_id,
                    data={
                        "order_id": order.id,
                        "mp_order_id": order.mp_order_id,
                        "credits_added": credits_to_add,
                        "amount_paid_brl": float(order.total_amount) if order.total_amount else 0.0,
                        "payment_method": order.payment_method_type.value if hasattr(order.payment_method_type, "value") else str(order.payment_method_type),
                        "new_balance": updated_wallet.balance_credits if updated_wallet else 0,
                    },
                )
        except Exception as err:
            logger.error(
                f"[OrderService] Erro ao creditar carteira para order '{order.id}': {err}"
            )
