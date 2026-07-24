from app.core.config.database import Base
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import DateTime, ForeignKey, Index, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship



class SubscriptionModel(Base):
    __tablename__ = "subscriptions"

    # Chave primária interna da nossa API
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # Multi-tenancy
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )

    # Chave Estrangeira Opcional para o Plano Local
    plan_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("plans.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Identificador Único na API do Mercado Pago (/preapproval)
    preapproval_id: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True, index=True
    )

    # Informações do Pagador e Status
    payer_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending", index=True)

    # Metadados e URLs de Checkout
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    external_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    init_point: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Detalhes do Meio de Pagamento Atribuído
    payment_method_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    card_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # JSON com as configurações de recorrência (frequency, currency, transaction_amount, free_trial)
    auto_recurring: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Controle Financeiro e de Ciclos
    next_payment_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relacionamento Opcional com o Plano
    plan = relationship("PlanModel", backref="subscriptions", lazy="noload")

    # Índices Compostos para Consultas Multitenant Paginadas/Filtradas
    __table_args__ = (
        Index("ix_subscriptions_tenant_status", "tenant_id", "status"),
        Index("ix_subscriptions_tenant_payer", "tenant_id", "payer_email"),
        Index("ix_subscriptions_tenant_preapproval", "tenant_id", "preapproval_id"),
    )