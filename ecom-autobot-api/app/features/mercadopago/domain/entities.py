import enum
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import DateTime, Enum, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.config.database import Base


class MercadoPagoWebhookStatus(str, enum.Enum):
    """Ciclo de vida do processamento de notificações de Webhook do Mercado Pago."""
    RECEIVED = "RECEIVED"
    PROCESSED = "PROCESSED"
    DUPLICATE = "DUPLICATE"
    FAILED = "FAILED"


class MercadoPagoWebhookLog(Base):
    """
    Entidade de persistência para auditoria e rastreamento atômico de notificações
    de Webhook recebidas da API do Mercado Pago.
    """
    __tablename__ = "mercadopago_webhook_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    tenant_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="default",
        index=True
    )
    event_type: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        index=True,
        doc="Tipo do evento de webhook (ex: payment.updated, subscription_preapproval.created)"
    )
    resource_id: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        index=True,
        doc="ID do recurso primário no Mercado Pago (ex: payment_id, preapproval_id)"
    )
    status: Mapped[MercadoPagoWebhookStatus] = mapped_column(
        Enum(MercadoPagoWebhookStatus, name="mp_webhook_status_enum", native_enum=False),
        nullable=False,
        default=MercadoPagoWebhookStatus.RECEIVED,
        index=True
    )
    x_request_id: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
        index=True
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    payload: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        Index("ix_mp_webhook_logs_tenant_resource", "tenant_id", "resource_id"),
        Index("ix_mp_webhook_logs_tenant_event", "tenant_id", "event_type"),
    )
