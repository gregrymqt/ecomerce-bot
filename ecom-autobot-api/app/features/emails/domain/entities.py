import enum
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import DateTime, Enum, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.config.database import Base


class EmailStatus(str, enum.Enum):
    """Ciclo de vida de entrega e rastreamento do e-mail."""
    PENDING = "PENDING"
    QUEUED = "QUEUED"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    DELIVERY_DELAYED = "DELIVERY_DELAYED"
    COMPLAINED = "COMPLAINED"
    BOUNCED = "BOUNCED"
    OPENED = "OPENED"
    CLICKED = "CLICKED"
    FAILED = "FAILED"


class EmailLog(Base):
    """
    Entidade de persistência para auditoria e rastreamento atômico de e-mails transacionais.
    Mapeia os identificadores retornados pelo Resend para correlação direta com Webhooks.
    """
    __tablename__ = "email_logs"

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
    resend_id: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
        index=True,
        doc="ID universal retornado pela API do Resend (ex: 49a3999c-0ce1-4ea6-ab68-afcd6dc2e794)"
    )
    recipient: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True
    )
    event_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        doc="Tipo de evento de negócio (ex: USER_WELCOME, RECHARGE_CONFIRMED)"
    )
    status: Mapped[EmailStatus] = mapped_column(
        Enum(EmailStatus, name="email_status_enum", native_enum=False),
        nullable=False,
        default=EmailStatus.PENDING,
        index=True
    )
    subject: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    idempotency_key: Mapped[Optional[str]] = mapped_column(
        String(256),
        nullable=True,
        index=True
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    metadata_info: Mapped[Dict[str, Any]] = mapped_column(
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
        Index("ix_email_logs_tenant_status", "tenant_id", "status"),
        Index("ix_email_logs_tenant_event", "tenant_id", "event_type"),
    )