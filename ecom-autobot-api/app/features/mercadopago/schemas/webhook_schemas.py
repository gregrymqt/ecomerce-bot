from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Union
from pydantic import BaseModel, ConfigDict, Field


class MercadoPagoDataDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[Union[str, int]] = Field(None, description="ID do recurso primário retornado na notificação")


class MercadoPagoNotificationPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[Union[str, int]] = Field(None)
    action: Optional[str] = Field(None)
    type: Optional[str] = Field(None)
    event: Optional[str] = Field(None)
    resource_id: Optional[str] = Field(None)
    data: Optional[MercadoPagoDataDTO] = Field(None)
    date_created: Optional[str] = Field(None)
    application_id: Optional[Union[int, str]] = Field(None)
    user_id: Optional[Union[int, str]] = Field(None)
    version: Optional[int] = None
    api_version: Optional[str] = None
    raw_payload: Dict[str, Any] = Field(default_factory=dict)

    @property
    def effective_resource_id(self) -> Optional[str]:
        if self.resource_id:
            return str(self.resource_id).strip()
        if self.data and self.data.id is not None:
            return str(self.data.id).strip()
        if self.id is not None:
            return str(self.id).strip()
        return None

    @property
    def effective_action(self) -> str:
        return self.action or self.type or self.event or "unknown"


class BaseNotificationHandler(ABC):
    @abstractmethod
    async def handle(self, payload: MercadoPagoNotificationPayload) -> None:
        """Contrato tornado assíncrono para garantir integridade das chamadas de DB/API."""
        pass


class WebhookEventPayload(BaseModel):
    topic: Optional[str] = None
    action: Optional[str] = None
    resource_id: Optional[str] = None
    payload: MercadoPagoNotificationPayload = Field(default_factory=MercadoPagoNotificationPayload)
    x_request_id: Optional[str] = None
