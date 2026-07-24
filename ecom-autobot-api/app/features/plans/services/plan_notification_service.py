import asyncio
import logging
from typing import Any, Dict, Optional, Union

import httpx

from app.features.plans.client import PlansClient
from app.features.plans.models import PlanModel
from app.features.plans.repository import PlansRepository
from app.features.plans.schemas import PlanResponse
from app.features.webhook_mercadopago.schemas import (
    BaseNotificationHandler,
    MercadoPagoNotificationPayload,
)

logger = logging.getLogger(__name__)


class PlanNotificationService(BaseNotificationHandler):
    """
    Serviço de domínio responsável pelo processamento otimizado e tipado de notificações 
    de Webhook referentes a Planos de Assinatura (Preapproval Plans) do Mercado Pago.
    """

    def __init__(
        self,
        repository: Optional[PlansRepository] = None,
        client: Optional[PlansClient] = None,
    ) -> None:
        self.repository = repository or PlansRepository()
        self.client = client or PlansClient()

    @staticmethod
    def _parse_int(value: Any) -> Optional[int]:
        """Converte com segurança identificadores numéricos retornados pela API sem exceção no fluxo comum."""
        if value is None:
            return None
        if isinstance(value, int):
            return value
        try:
            return int(value)
        except (ValueError, TypeError):
            return None

    def handle(self, payload: Union[MercadoPagoNotificationPayload, Dict[str, Any]]) -> None:
        """
        Ponto de entrada síncrono exigido pela interface BaseNotificationHandler.
        Redireciona o processamento para o evento loop ativo sem criar loops redundantes.
        """
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            loop.create_task(self.handle_async(payload))
        else:
            asyncio.run(self.handle_async(payload))

    async def handle_async(
        self, payload: Union[MercadoPagoNotificationPayload, Dict[str, Any]]
    ) -> None:
        """
        Processa assincronamente as notificações de atualização ou criação de planos de assinatura.
        Desempenho otimizado com eliminação de consultas redundantes ao banco.
        """
        notification = (
            payload
            if isinstance(payload, MercadoPagoNotificationPayload)
            else MercadoPagoNotificationPayload.model_validate(payload)
        )

        resource_id = notification.effective_resource_id
        if not resource_id:
            logger.warning("[PlanNotificationService] Notificação descartada: nenhum ID de recurso válido no payload.")
            return

        logger.info(f"[PlanNotificationService] Processando evento para o plano ID / External ID: '{resource_id}'")

        try:
            # 1. Consulta única com fallback interno unificado no repositório (evita 2x I/O de rede)
            existing_plan = await self.repository.get_by_external_id(resource_id)

            # 2. Busca os dados atualizados diretamente na API REST do Mercado Pago
            mp_plan: Optional[PlanResponse] = None
            try:
                mp_plan = await self.client.get_plan_by_id(resource_id)
            except httpx.HTTPStatusError as http_err:
                logger.error(
                    f"[PlanNotificationService] Erro HTTP {http_err.response.status_code} ao buscar plano '{resource_id}' no Mercado Pago: {http_err.response.text}"
                )
            except Exception as api_err:
                logger.error(
                    f"[PlanNotificationService] Falha de comunicação com Mercado Pago para plano '{resource_id}': {api_err}"
                )

            # 3. Se o plano já existir localmente: atualização com limpeza inline
            if existing_plan:
                update_fields: Dict[str, Any] = {}
                if mp_plan:
                    auto_recurring_data = (
                        mp_plan.auto_recurring
                        if isinstance(mp_plan.auto_recurring, dict)
                        else mp_plan.auto_recurring.model_dump()
                    )
                    update_fields = {
                        "external_id": mp_plan.external_id or mp_plan.id or resource_id,
                        "reason": mp_plan.reason,
                        "status": mp_plan.status,
                        "auto_recurring": auto_recurring_data,
                        "back_url": mp_plan.back_url,
                        "collector_id": self._parse_int(mp_plan.collector_id),
                        "application_id": self._parse_int(mp_plan.application_id),
                    }
                else:
                    action_str = notification.effective_action.lower()
                    if "cancel" in action_str:
                        update_fields["status"] = "cancelled"
                    elif "active" in action_str or "created" in action_str:
                        update_fields["status"] = "active"

                clean_fields = {k: v for k, v in update_fields.items() if v is not None}
                if clean_fields:
                    await self.repository.update(existing_plan.id, clean_fields)
                    logger.info(f"[PlanNotificationService] Plano local ID '{existing_plan.id}' atualizado via Webhook.")

            # 4. Se o plano não existir localmente: inserção direta
            else:
                if mp_plan:
                    auto_recurring_data = (
                        mp_plan.auto_recurring
                        if isinstance(mp_plan.auto_recurring, dict)
                        else mp_plan.auto_recurring.model_dump()
                    )
                    new_plan_model = PlanModel(
                        id=mp_plan.id,
                        external_id=mp_plan.external_id or mp_plan.id or resource_id,
                        reason=mp_plan.reason,
                        status=mp_plan.status,
                        auto_recurring=auto_recurring_data,
                        back_url=mp_plan.back_url,
                        collector_id=self._parse_int(mp_plan.collector_id),
                        application_id=self._parse_int(mp_plan.application_id),
                    )
                    await self.repository.save(new_plan_model)
                    logger.info(f"[PlanNotificationService] Novo plano ID '{new_plan_model.id}' sincronizado via Webhook.")

        except Exception as err:
            logger.error(
                f"[PlanNotificationService] Erro ao processar notificação de plano: {err}",
                exc_info=True,
            )
