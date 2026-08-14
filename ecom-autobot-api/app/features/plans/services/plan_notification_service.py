import logging
from typing import Any, Dict, Optional

from app.features.mercadopago.schemas.webhook_schemas import (
    BaseNotificationHandler,
    MercadoPagoNotificationPayload,
)
from app.features.plans.repositories.plans_repository import PlansRepository

logger = logging.getLogger(__name__)


class PlanNotificationService(BaseNotificationHandler):
    """
    Serviço de domínio responsável pelo processamento assíncrono de notificações de eventos 
    referentes a Planos de Assinatura, operando 100% via Banco de Dados local.
    
    Herda de BaseNotificationHandler e cumpre o contrato assíncrono 'async def handle'.
    """

    def __init__(
        self,
        repository: Optional[PlansRepository] = None,
    ) -> None:
        self.repository = repository or PlansRepository()

    @staticmethod
    def _parse_int(value: Any) -> Optional[int]:
        """Converte com segurança identificadores numéricos retornados sem exceção no fluxo comum."""
        if value is None:
            return None
        if isinstance(value, int):
            return value
        try:
            return int(value)
        except (ValueError, TypeError):
            return None

    async def handle(self, payload: MercadoPagoNotificationPayload) -> None:
        """
        Ponto de entrada assíncrono do serviço.
        Atualiza o status dos planos no PostgreSQL e inverte/limpa o cache Redis sem chamadas externas.
        """
        resource_id = payload.effective_resource_id
        if not resource_id:
            logger.warning("[PlanNotificationService] Notificação descartada: nenhum ID de recurso válido no payload.")
            return

        logger.info(
            f"[PlanNotificationService] Processando evento '{payload.effective_action}' para o plano ID / External ID: '{resource_id}'"
        )

        try:
            # 1. Consulta o plano na base local pelo external_id ou pelo ID primário
            existing_plan = await self.repository.get_by_external_id(resource_id)
            if not existing_plan:
                existing_plan = await self.repository.get_by_id(resource_id)

            if existing_plan:
                action_str = (payload.effective_action or "").lower()
                update_fields: Dict[str, Any] = {}

                if "cancel" in action_str or "pause" in action_str:
                    update_fields["status"] = "canceled"
                elif "active" in action_str or "created" in action_str or "update" in action_str:
                    update_fields["status"] = "active"

                clean_fields = {k: v for k, v in update_fields.items() if v is not None}
                if clean_fields:
                    await self.repository.update(existing_plan.id, clean_fields)
                    logger.info(f"[PlanNotificationService] Plano local ID '{existing_plan.id}' atualizado via Webhook. Status='{clean_fields.get('status')}'")
            else:
                logger.info(
                    f"[PlanNotificationService] Notificação para plano '{resource_id}' ignorada: registro não encontrado na base local."
                )

        except Exception as err:
            logger.error(
                f"[PlanNotificationService] Erro ao processar notificação de plano: {err}",
                exc_info=True,
            )
