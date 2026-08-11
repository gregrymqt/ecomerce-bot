from pydantic import BaseModel, EmailStr, Field
from typing import Any, Dict, Optional
from datetime import datetime, timezone


class EmailEventPayload(BaseModel):
    """Schema Pydantic para payloads JSON publicados na fila email_notifications."""
    event: str = Field(..., description="Nome do evento (ex: USER_WELCOME, RECHARGE_CONFIRMED)")
    recipient_email: EmailStr = Field(..., description="E-mail do destinatário")
    recipient_name: Optional[str] = Field("Cliente", description="Nome do destinatário")
    tenant_id: str = Field("default", description="Identificador do tenant/organização")
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    data: Dict[str, Any] = Field(default_factory=dict, description="Metadados adicionais do contexto Jinja2")
