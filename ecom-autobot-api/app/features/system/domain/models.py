import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Column, DateTime, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.config.database import Base


class RobotActivityModel(Base):
    __tablename__ = "robot_activities"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )
    worker_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # 'scraper' | 'processor'
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # 'SUCCESS' | 'FAILED' | 'PROCESSING'
    details: Mapped[Optional[Any]] = mapped_column(
        JSONB, nullable=True
    )
    duration_ms: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    __table_args__ = (
        Index("ix_robot_activities_tenant_created", "tenant_id", "created_at"),
        Index("ix_robot_activities_tenant_status", "tenant_id", "status"),
    )


class TokenTelemetryModel(Base):
    __tablename__ = "token_telemetry"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # 'deepseek' | 'groq' | 'openai' | 'openrouter'
    prompt_tokens: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    completion_tokens: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    total_tokens: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    __table_args__ = (
        Index("ix_token_telemetry_tenant_provider", "tenant_id", "provider"),
        Index("ix_token_telemetry_tenant_created", "tenant_id", "created_at"),
    )
