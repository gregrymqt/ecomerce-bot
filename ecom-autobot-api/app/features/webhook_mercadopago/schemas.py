from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Union
from pydantic import BaseModel, Field


class MercadoPagoDataDTO(BaseModel):
    """
    DTO tipado para o objeto interno 'data' das notificações do Mercado Pago.
    """
    id: Optional[Union[str, int]] = Field(None, description="ID do recurso primário retornado na notificação")

    class Config:
        populate_by_name = True


class MercadoPagoNotificationPayload(BaseModel):
    """
    DTO completo com autocompletar / IntelliSense para o payload recebido do Webhook do Mercado Pago.
    """
    id: Optional[Union[str, int]] = Field(None, description="ID da notificação do webhook")
    action: Optional[str] = Field(None, description="Ação disparada (ex: subscription_preapproval_plan.updated, payment.created)")
    type: Optional[str] = Field(None, description="Tópico ou tipo do evento (ex: subscription_preapproval_plan, payment)")
    event: Optional[str] = Field(None, description="Nome alternativo do evento")
    resource_id: Optional[str] = Field(None, description="ID normalizado do recurso")
    data: Optional[MercadoPagoDataDTO] = Field(None, description="Objeto de dados da notificação contendo o id")
    date_created: Optional[str] = Field(None, description="Data de criação da notificação")
    application_id: Optional[Union[int, str]] = Field(None, description="ID da aplicação")
    user_id: Optional[Union[int, str]] = Field(None, description="ID do coletor/usuário MP")
    version: Optional[int] = None
    api_version: Optional[str] = None
    raw_payload: Dict[str, Any] = Field(default_factory=dict, description="Payload bruto para retrocompatibilidade")

    @property
    def effective_resource_id(self) -> Optional[str]:
        """
        Retorna o ID do recurso notificado com suporte total a IntelliSense.
        Evita chamadas arriscadas a dicionários aninhados como payload.get('data', {}).get('id').
        """
        if self.resource_id:
            return str(self.resource_id).strip()
        if self.data and self.data.id is not None:
            return str(self.data.id).strip()
        if self.id is not None:
            return str(self.id).strip()
        return None

    @property
    def effective_action(self) -> str:
        """
        Retorna o tipo ou ação da notificação tipado.
        """
        return self.action or self.type or self.event or "unknown"

    class Config:
        populate_by_name = True


class BaseNotificationHandler(ABC):
    """
    Classe base abstrata para manipulação de notificações de Webhook.
    Todas as classes de serviço de notificação nas features devem herdar desta classe
    e implementar o método `handle(payload)`.
    """

    @abstractmethod
    def handle(self, payload: Union[MercadoPagoNotificationPayload, Dict[str, Any]]) -> None:
        pass


class WebhookEventPayload(BaseModel):
    """
    DTO padrão para transporte de eventos processados no RabbitMQ.
    """
    topic: Optional[str] = None
    action: Optional[str] = None
    resource_id: Optional[str] = None
    payload: MercadoPagoNotificationPayload = Field(default_factory=MercadoPagoNotificationPayload)
    x_request_id: Optional[str] = None
