from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import JSON, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.config.database import Base


class PlanModel(Base):
    """
    Representação da tabela de planos sincronizados com o Mercado Pago.
    """
    __tablename__ = "plans"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # ID interno ou do Mercado Pago
    external_id: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True, nullable=True)  # ID / Referência externa do Mercado Pago
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    auto_recurring: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    back_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    collector_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    application_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
