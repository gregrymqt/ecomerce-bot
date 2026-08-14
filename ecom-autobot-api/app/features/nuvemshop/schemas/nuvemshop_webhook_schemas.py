from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class NuvemshopWebhookPayload(BaseModel):
    """Payload padronizado de eventos recebidos via Webhook da Nuvemshop."""

    store_id: int = Field(..., description="ID da loja Nuvemshop emissora do evento")
    event: str = Field(..., description="Tópico do evento (ex: product/created, product/updated, product/deleted, app/uninstalled)")
    id: Optional[int] = Field(None, description="ID do recurso afetado na Nuvemshop")
    data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Dados complementares do evento")


class NuvemshopWebhookQueueMessage(BaseModel):
    """Envelope serializado publicado na fila RabbitMQ 'nuvemshop_webhook'."""

    event_id: str = Field(..., description="Identificador único para idempotência do evento")
    store_id: int = Field(..., description="ID da loja Nuvemshop")
    event: str = Field(..., description="Tópico do evento")
    resource_id: Optional[int] = Field(None, description="ID do recurso afetado")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Dados brutos recebidos da Nuvemshop")
    received_at: str = Field(..., description="Timestamp ISO 8601 de recepção do webhook")
