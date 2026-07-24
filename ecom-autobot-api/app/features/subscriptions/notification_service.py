import logging
from typing import Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import AsyncSessionLocal
from app.features.mercadopago.schemas import (
    BaseNotificationHandler,
    MercadoPagoNotificationPayload,
)
from app.features.subscriptions.client import SubscriptionsClient
from app.features.subscriptions.models import SubscriptionModel
from app.features.subscriptions.repository import SubscriptionsRepository
from app.features.subscriptions.schemas import SubscriptionStatusEnum

logger = logging.getLogger(__name__)


class SubscriptionNotificationService(BaseNotificationHandler):
    """
    Handler especializado no processamento assíncrono de Webhooks de Assinaturas (subscription_preapproval).
    Consulta a API do Mercado Pago (GET /preapproval/{id}), atualiza o estado local e purga o Redis.
    
    Suporta injeção de sessão ou gerenciamento autônomo de sessão via AsyncSessionLocal com a helper `_get_session()`.
    """

    def __init__(
        self,
        repository: Optional[SubscriptionsRepository] = None,
        client: Optional[SubscriptionsClient] = None,
        session: Optional[AsyncSession] = None,
    ):
        self.session = session
        self.repository = repository or SubscriptionsRepository(session=session)
        self.client = client or SubscriptionsClient()

    async def _get_session(self) -> Tuple[AsyncSession, bool]:
        """
        Retorna a sessão injetada ou cria uma nova sessão AsyncSessionLocal.
        Retorna uma tupla (session, owned) indicando se a sessão deve ser fechada localmente.
        """
        if self.session is not None:
            return self.session, False
        session = AsyncSessionLocal()
        return session, True

    async def _find_local_subscription_by_preapproval_id(
        self, preapproval_id: str
    ) -> Optional[SubscriptionModel]:
        """
        Busca globalmente no PostgreSQL a assinatura local pelo preapproval_id do Mercado Pago.
        Útil para identificar o tenant_id sem depender do payload da mensagem.
        """
        session, owned = await self._get_session()
        try:
            stmt = select(SubscriptionModel).where(
                SubscriptionModel.preapproval_id == preapproval_id
            )
            result = await session.execute(stmt)
            return result.scalar_one_or_none()
        finally:
            if owned:
                await session.close()

    async def handle(self, payload: MercadoPagoNotificationPayload) -> None:
        preapproval_id = payload.effective_resource_id
        action = payload.effective_action

        if not preapproval_id:
            logger.warning("[SubscriptionWebhook] Notificação recebida sem ID de recurso (preapproval_id). Ignorando.")
            return

        logger.info(f"🔄 [SubscriptionWebhook] Processando evento '{action}' para a assinatura MP: '{preapproval_id}'")

        try:
            # 1. Consulta o estado atualizado da assinatura diretamente na API REST do Mercado Pago (GET /preapproval/{id})
            mp_subscription = await self.client.get_subscription_by_id(preapproval_id)

            # 2. Localiza o registro correspondente no banco local
            local_sub = await self._find_local_subscription_by_preapproval_id(preapproval_id)

            if not local_sub:
                logger.warning(
                    f"⚠️ [SubscriptionWebhook] Assinatura MP '{preapproval_id}' não encontrada no banco local. Nenhuma ação realizada."
                )
                return

            # 3. Mapeia os novos valores
            status_value = (
                mp_subscription.status.value
                if isinstance(mp_subscription.status, SubscriptionStatusEnum)
                else str(mp_subscription.status)
            )

            update_data = {
                "status": status_value,
                "reason": mp_subscription.reason or local_sub.reason,
                "payment_method_id": mp_subscription.payment_method_id or local_sub.payment_method_id,
                "card_id": str(mp_subscription.card_id) if mp_subscription.card_id else local_sub.card_id,
                "next_payment_date": mp_subscription.next_payment_date or local_sub.next_payment_date,
            }

            if mp_subscription.auto_recurring:
                update_data["auto_recurring"] = mp_subscription.auto_recurring.model_dump(
                    mode="json", exclude_none=True
                )

            # 4. Atualiza no PostgreSQL e invalida os caches do Redis via repositório
            updated_sub = await self.repository.update(
                tenant_id=local_sub.tenant_id,
                subscription_id=local_sub.id,
                update_data=update_data,
            )

            logger.info(
                f"✅ [SubscriptionWebhook] Assinatura '{updated_sub.id}' (Tenant: {updated_sub.tenant_id}) atualizada via Webhook! Status: '{updated_sub.status}'"
            )

        except Exception as err:
            logger.error(
                f"💥 [SubscriptionWebhook] Falha ao processar notificação da assinatura '{preapproval_id}': {err}",
                exc_info=True,
            )
            raise err