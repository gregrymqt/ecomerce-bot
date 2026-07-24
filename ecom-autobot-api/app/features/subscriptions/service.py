import logging
from typing import List, Optional, Tuple

from fastapi import HTTPException, status

from app.features.plans.repository import PlansRepository
from app.features.subscriptions.client import SubscriptionsClient
from app.features.subscriptions.models import SubscriptionModel
from app.features.subscriptions.repository import SubscriptionsRepository
from app.features.subscriptions.schemas import (
    CreateSubscriptionRequest,
    MercadoPagoUpdatePreapprovalRequest,
    SearchSubscriptionsQueryParams,
    SubscriptionResponse,
    SubscriptionStatusEnum,
    UpdateAutoRecurringDTO,
    UpdateSubscriptionRequest,
)

logger = logging.getLogger(__name__)


class SubscriptionsService:
    """
    Serviço responsável por orquestrar a lógica de negócios de Assinaturas (Subscriptions),
    sincronizando operações entre a REST API do Mercado Pago e a persistência local (Postgres + Redis).
    """

    def __init__(
        self,
        repository: Optional[SubscriptionsRepository] = None,
        client: Optional[SubscriptionsClient] = None,
        plans_repository: Optional[PlansRepository] = None,
    ):
        self.repository = repository or SubscriptionsRepository()
        self.client = client or SubscriptionsClient()
        self.plans_repository = plans_repository or PlansRepository()

    # --------------------------------------------------------------------
    # 1. Criar Assinatura (POST /preapproval)
    # --------------------------------------------------------------------

    async def create_subscription(
        self,
        tenant_id: str,
        request: CreateSubscriptionRequest,
    ) -> SubscriptionResponse:
        """
        Cria uma nova assinatura no Mercado Pago e persiste o registro no banco de dados local.
        """
        logger.info(
            f"[SubscriptionsService] Criando assinatura para o tenant '{tenant_id}' | Pagador: '{request.payer_email}'"
        )

        # 1. Tenta resolver o ID interno do plano se preapproval_plan_id for fornecido
        local_plan_id: Optional[str] = None
        if request.preapproval_plan_id and self.plans_repository:
            try:
                # ✅ CORREÇÃO: Chama sem tenant_id, pois a tabela de planos é GLOBAL
                plan = await self.plans_repository.get_by_external_id(
                    external_id=request.preapproval_plan_id
                )
                if plan:
                    local_plan_id = plan.id
            except Exception as err:
                logger.warning(
                    f"[SubscriptionsService] Não foi possível vincular o plano local '{request.preapproval_plan_id}': {err}"
                )

        # 2. Chama a API do Mercado Pago
        mp_subscription = await self.client.create_subscription(data=request)

        # 3. Mapeia as configurações de recorrência retornadas para um dicionário JSON
        auto_recurring_dict = (
            mp_subscription.auto_recurring.model_dump(mode="json", exclude_none=True)
            if mp_subscription.auto_recurring
            else None
        )

        # 4. Instancia e salva a Model SQLAlchemy no banco local
        status_value = (
            mp_subscription.status.value
            if isinstance(mp_subscription.status, SubscriptionStatusEnum)
            else str(mp_subscription.status)
        )

        new_subscription = SubscriptionModel(
            tenant_id=tenant_id,
            plan_id=local_plan_id,
            preapproval_id=mp_subscription.id,
            payer_email=request.payer_email,
            status=status_value,
            reason=mp_subscription.reason or request.reason,
            external_reference=str(mp_subscription.external_reference)
            if mp_subscription.external_reference
            else request.external_reference,
            init_point=mp_subscription.init_point,
            payment_method_id=mp_subscription.payment_method_id,
            card_id=str(mp_subscription.card_id) if mp_subscription.card_id else None,
            auto_recurring=auto_recurring_dict,
            next_payment_date=mp_subscription.next_payment_date,
        )

        saved_subscription = await self.repository.create(new_subscription)

        logger.info(
            f"[SubscriptionsService] Assinatura '{saved_subscription.id}' (MP: {saved_subscription.preapproval_id}) salva com sucesso!"
        )

        return SubscriptionResponse.model_validate(saved_subscription)

    # --------------------------------------------------------------------
    # 2. Obter Assinatura por ID (GET /subscriptions/{id})
    # --------------------------------------------------------------------

    async def get_subscription_by_id(
        self,
        tenant_id: str,
        subscription_id: str,
        sync_with_mp: bool = False,
    ) -> SubscriptionResponse:
        """
        Busca uma assinatura pelo seu ID interno.
        Opcionalmente realiza sincronização ativa com o Mercado Pago se sync_with_mp=True.
        """
        subscription = await self.repository.get_by_id(
            tenant_id=tenant_id, subscription_id=subscription_id
        )

        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Assinatura '{subscription_id}' não encontrada.",
            )

        # Sincronização ativa opcional com a API do Mercado Pago
        if sync_with_mp:
            try:
                mp_sub = await self.client.get_subscription_by_id(subscription.preapproval_id)
                status_val = mp_sub.status.value if isinstance(mp_sub.status, SubscriptionStatusEnum) else str(mp_sub.status)
                
                update_data = {
                    "status": status_val,
                    "payment_method_id": mp_sub.payment_method_id,
                    "card_id": str(mp_sub.card_id) if mp_sub.card_id else None,
                    "next_payment_date": mp_sub.next_payment_date,
                }
                
                updated_model = await self.repository.update(
                    tenant_id=tenant_id,
                    subscription_id=subscription_id,
                    update_data=update_data,
                )
                if updated_model:
                    subscription = updated_model
            except Exception as err:
                logger.warning(
                    f"[SubscriptionsService] Erro ao sincronizar assinatura com o MP: {err}"
                )

        return SubscriptionResponse.model_validate(subscription)

    # --------------------------------------------------------------------
    # 3. Buscar / Listar Assinaturas (GET /subscriptions)
    # --------------------------------------------------------------------

    async def search_subscriptions(
        self,
        tenant_id: str,
        params: SearchSubscriptionsQueryParams,
    ) -> Tuple[List[SubscriptionResponse], int]:
        """
        Realiza a busca paginada e filtrada de assinaturas no banco local.
        """
        skip = (params.page - 1) * params.limit

        subscriptions, total = await self.repository.search(
            tenant_id=tenant_id,
            skip=skip,
            limit=params.limit,
            status=params.status.value if params.status else None,
            payer_email=params.payer_email,
            plan_id=params.preapproval_plan_id,
        )

        response_items = [
            SubscriptionResponse.model_validate(item) for item in subscriptions
        ]

        return response_items, total

    # --------------------------------------------------------------------
    # 4. Atualizar Assinatura (PUT /subscriptions/{id})
    # --------------------------------------------------------------------

    async def update_subscription(
        self,
        tenant_id: str,
        subscription_id: str,
        request: UpdateSubscriptionRequest,
    ) -> SubscriptionResponse:
        """
        Atualiza os dados de uma assinatura na API do Mercado Pago e reflete as alterações no banco local.
        """
        # 1. Garante a existência da assinatura local
        subscription = await self.repository.get_by_id(
            tenant_id=tenant_id, subscription_id=subscription_id
        )

        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Assinatura '{subscription_id}' não encontrada.",
            )

        # 2. Constrói a requisição para a API do Mercado Pago
        update_auto_recurring = None
        if request.auto_recurring:
            update_auto_recurring = UpdateAutoRecurringDTO(
                transaction_amount=request.auto_recurring.transaction_amount,
                currency_id=request.auto_recurring.currency_id,
            )

        mp_update_req = MercadoPagoUpdatePreapprovalRequest(
            reason=request.reason,
            back_url=str(request.back_url) if request.back_url else None,
            auto_recurring=update_auto_recurring,
            card_token_id=request.card_token_id,
            status=request.status,
        )

        # 3. Atualiza no Mercado Pago
        mp_response = await self.client.update_subscription(
            preapproval_id=subscription.preapproval_id,
            data=mp_update_req,
        )

        # 4. Atualiza os dados no banco local e invalida o cache
        status_value = (
            mp_response.status.value
            if isinstance(mp_response.status, SubscriptionStatusEnum)
            else str(mp_response.status)
        )

        update_data = {
            "reason": mp_response.reason or subscription.reason,
            "status": status_value,
            "payment_method_id": mp_response.payment_method_id or subscription.payment_method_id,
            "card_id": str(mp_response.card_id) if mp_response.card_id else subscription.card_id,
            "next_payment_date": mp_response.next_payment_date or subscription.next_payment_date,
        }

        if mp_response.auto_recurring:
            update_data["auto_recurring"] = mp_response.auto_recurring.model_dump(
                mode="json", exclude_none=True
            )

        updated_subscription = await self.repository.update(
            tenant_id=tenant_id,
            subscription_id=subscription_id,
            update_data=update_data,
        )

        logger.info(
            f"[SubscriptionsService] Assinatura '{subscription_id}' atualizada localmente com sucesso!"
        )

        return SubscriptionResponse.model_validate(updated_subscription)

    # --------------------------------------------------------------------
    # 5. Cancelar Assinatura (Atalho DELETE/POST Cancel)
    # --------------------------------------------------------------------

    async def cancel_subscription(
        self,
        tenant_id: str,
        subscription_id: str,
    ) -> SubscriptionResponse:
        """
        Cancela uma assinatura alterando seu status para 'cancelled' no Mercado Pago e localmente.
        """
        return await self.update_subscription(
            tenant_id=tenant_id,
            subscription_id=subscription_id,
            request=UpdateSubscriptionRequest(status=SubscriptionStatusEnum.CANCELLED),
        )