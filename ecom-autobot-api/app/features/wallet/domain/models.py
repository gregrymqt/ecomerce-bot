import enum
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.config.database import Base


class TransactionType(str, enum.Enum):
    """Tipos de transação no extrato da carteira pré-paga."""
    RECHARGE = "RECHARGE"
    USAGE = "USAGE"


class WalletModel(Base):
    """
    Modelo SQLAlchemy 2.0 para a tabela 'wallets' (carteira pré-paga por tenant).
    """
    __tablename__ = "wallets"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()), comment="ID da carteira (UUID)"
    )
    tenant_id: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True, comment="Isolamento Multi-tenant"
    )
    balance_credits: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="Saldo total de créditos acumulados"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relacionamento 1:N com CreditTransactionModel
    transactions: Mapped[List["CreditTransactionModel"]] = relationship(
        "CreditTransactionModel",
        back_populates="wallet",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint("balance_credits >= 0", name="check_balance_credits_non_negative"),
    )


class CreditTransactionModel(Base):
    """
    Modelo SQLAlchemy 2.0 para a tabela 'credit_transactions' (extrato de créditos/consumo).
    """
    __tablename__ = "credit_transactions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()), comment="ID da transação (UUID)"
    )
    tenant_id: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True, comment="Isolamento Multi-tenant"
    )
    wallet_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Valor em créditos: positivo para RECHARGE, negativo para USAGE"
    )
    type: Mapped[TransactionType] = mapped_column(
        SQLEnum(TransactionType, name="credit_transaction_type_enum", native_enum=False),
        nullable=False,
        comment="Tipo de transação: RECHARGE ou USAGE",
    )
    description: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="Descrição detalhada do crédito/consumo"
    )
    external_payment_id: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, index=True, comment="ID do pagamento externo para idempotência (Mercado Pago)"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relacionamento com WalletModel
    wallet: Mapped["WalletModel"] = relationship(
        "WalletModel", back_populates="transactions"
    )
