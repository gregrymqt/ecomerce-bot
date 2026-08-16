import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.features.emails.domain.entities import EmailStatus


class EmailEventPayload(BaseModel):
    """Schema para mensagens serializadas trafegadas na fila RabbitMQ 'email_notifications'."""
    event: str = Field(..., description="Nome do evento de negócio (ex: USER_WELCOME)")
    recipient_email: EmailStr = Field(..., description="E-mail de destino")
    recipient_name: Optional[str] = Field("Cliente", description="Nome do cliente para o template")
    tenant_id: str = Field("default", description="Identificador único do tenant")
    idempotency_key: Optional[str] = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Chave única de idempotência para o disparo"
    )
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="Carimbo de data/hora do disparo em UTC"
    )
    data: Dict[str, Any] = Field(
        default_factory=dict,
        description="Contexto dinâmico injetado no template Jinja2"
    )

    model_config = ConfigDict(extra="ignore")


class EmailLogResponseDTO(BaseModel):
    """DTO de leitura do histórico de e-mails para consumo na API/Painel Web."""
    id: uuid.UUID
    tenant_id: str
    resend_id: Optional[str] = None
    recipient: str
    event_type: str
    status: EmailStatus
    subject: str
    idempotency_key: Optional[str] = None
    error_message: Optional[str] = None
    metadata_info: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)