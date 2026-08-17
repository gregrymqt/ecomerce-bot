import enum
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import BigInteger, DateTime, Enum, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.config.database import Base


@dataclass
class NuvemshopCredentials:
    """Entidade de domínio com as credenciais autenticadas da Nuvemshop para um tenant."""
    store_id: str
    access_token: str
    app_email: str


class NuvemshopWebhookStatus(str, enum.Enum):
    """Ciclo de vida do processamento de notificações de Webhook da Nuvemshop."""
    RECEIVED = "RECEIVED"
    PROCESSED = "PROCESSED"
    DUPLICATE = "DUPLICATE"
    FAILED = "FAILED"


class NuvemshopWebhookLog(Base):
    """
    Entidade de persistência para auditoria e rastreamento atômico de notificações
    de Webhook recebidas da loja Nuvemshop.
    """
    __tablename__ = "nuvemshop_webhook_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    store_id: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        index=True,
        doc="ID da loja Nuvemshop remetente"
    )
    event_id: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        index=True,
        doc="Identificador composto único do evento (ex: store_id:event:resource_id)"
    )
    event: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        index=True,
        doc="Tipo de evento (ex: product/created, order/paid)"
    )
    resource_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        nullable=True,
        index=True,
        doc="ID do recurso alterado na Nuvemshop"
    )
    status: Mapped[NuvemshopWebhookStatus] = mapped_column(
        Enum(NuvemshopWebhookStatus, name="nuvemshop_webhook_status_enum", native_enum=False),
        nullable=False,
        default=NuvemshopWebhookStatus.RECEIVED,
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
        Index("ix_nuvemshop_webhook_logs_store_event", "store_id", "event"),
    )
