from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class ResendWebhookData(BaseModel):
    """Dados internos da mensagem enviados dentro do payload de webhook do Resend."""
    email_id: Optional[str] = Field(
        None,
        validation_alias=AliasChoices("email_id", "id"),
        description="UUID do e-mail no Resend"
    )
    from_email: Optional[str] = Field(None, alias="from")
    to: Optional[List[str]] = Field(default_factory=list)
    subject: Optional[str] = None
    created_at: Optional[datetime] = None
    tags: Optional[Dict[str, Any]] = Field(default_factory=dict)
    bounce: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class ResendWebhookPayload(BaseModel):
    """Payload raiz de notificação de webhook do Resend."""
    type: str = Field(..., description="Tipo do evento (ex: email.delivered, email.bounced)")
    created_at: datetime = Field(..., description="Timestamp do evento gerado pelo Resend")
    data: ResendWebhookData = Field(..., description="Objeto com detalhes do e-mail")

    model_config = ConfigDict(extra="ignore")