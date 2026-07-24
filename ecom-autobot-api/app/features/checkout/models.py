from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    JSON,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config.database import Base
from app.features.checkout.enums import OrderStatus, OrderStatusDetail, PaymentMethodType


class OrderModel(Base):
    __tablename__ = "checkout_orders"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="ID do pedido no sistema interno (ex: ord_12345)")
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True, comment="Isolamento Multi-Tenant")
    mp_order_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True, comment="ID retornado pelo Mercado Pago (ORD...)")
    external_reference: Mapped[str] = mapped_column(String(150), nullable=False, index=True, comment="Chave única do pedido no tenant")
    
    # Status & Modos
    status: Mapped[OrderStatus] = mapped_column(SQLEnum(OrderStatus), nullable=False, default=OrderStatus.CREATED)
    status_detail: Mapped[Optional[OrderStatusDetail]] = mapped_column(SQLEnum(OrderStatusDetail), nullable=True)
    payment_method_type: Mapped[PaymentMethodType] = mapped_column(SQLEnum(PaymentMethodType), nullable=False)
    
    # Valores Financeiros
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_paid_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"))
    
    # Comprador
    payer_email: Mapped[str] = mapped_column(String(255), nullable=False)
    payer_document_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    payer_document_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    
    # Dados Específicos do Meio de Pagamento
    ticket_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="URL do Boleto / Comprovante")
    pix_qr_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="Chave PIX Copia e Cola")
    pix_qr_code_base64: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="Imagem Base64 do QR Code")
    pix_expiration_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Snapshots de Auditoria
    raw_mp_response: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True, comment="Snapshot completo do payload do MP")
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relacionamento com itens
    items: Mapped[List["OrderItemModel"]] = relationship("OrderItemModel", back_populates="order", cascade="all, delete-orphan", lazy="selectin")

    __table_args__ = (
        Index("idx_orders_tenant_ext_ref", "tenant_id", "external_reference", unique=True),
        Index("idx_orders_tenant_mp_id", "tenant_id", "mp_order_id"),
    )

    def to_dict(self) -> Dict[str, Any]:
        """Serialização para persistência no Redis Cache."""
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "mp_order_id": self.mp_order_id,
            "external_reference": self.external_reference,
            "status": self.status.value if isinstance(self.status, OrderStatus) else self.status,
            "status_detail": self.status_detail.value if isinstance(self.status_detail, OrderStatusDetail) else self.status_detail,
            "payment_method_type": self.payment_method_type.value if isinstance(self.payment_method_type, PaymentMethodType) else self.payment_method_type,
            "total_amount": str(self.total_amount),
            "total_paid_amount": str(self.total_paid_amount),
            "payer_email": self.payer_email,
            "payer_document_type": self.payer_document_type,
            "payer_document_number": self.payer_document_number,
            "ticket_url": self.ticket_url,
            "pix_qr_code": self.pix_qr_code,
            "pix_qr_code_base64": self.pix_qr_code_base64,
            "pix_expiration_date": self.pix_expiration_date.isoformat() if self.pix_expiration_date else None,
            "raw_mp_response": self.raw_mp_response,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class OrderItemModel(Base):
    __tablename__ = "checkout_order_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[str] = mapped_column(String(64), ForeignKey("checkout_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(nullable=False, default=1)
    external_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    order: Mapped["OrderModel"] = relationship("OrderModel", back_populates="items")