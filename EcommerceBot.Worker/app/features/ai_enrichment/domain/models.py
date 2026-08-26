from decimal import Decimal
import uuid
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Index, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.config.database import Base


class LLMUsageLogModel(Base):
    __tablename__ = "llm_usage_logs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )
    product_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True, index=True
    )
    provider: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    model_used: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )
    prompt_tokens: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    completion_tokens: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    total_tokens: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    estimated_cost_usd: Mapped[Decimal] = mapped_column(
        Numeric(10, 6), nullable=False, default=Decimal("0.000000")
    )
    is_byok: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, index=True
    )
    execution_time_ms: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    __table_args__ = (
        Index("ix_llm_usage_logs_tenant_created", "tenant_id", "created_at"),
        Index("ix_llm_usage_logs_tenant_byok", "tenant_id", "is_byok"),
    )
