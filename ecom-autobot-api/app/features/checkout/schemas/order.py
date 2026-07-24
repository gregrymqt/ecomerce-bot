from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.features.checkout.domain.enums import (
    CaptureMode,
    OrderStatus,
    OrderStatusDetail,
    OrderType,
    ProcessingMode,
)
from app.features.checkout.schemas.common import (
    IntegrationDataInputSchema,
    OrderItemSchema,
    PayerInputSchema,
    ShipmentInputSchema,
)
from app.features.checkout.schemas.payment import (
    OrderConfigInputSchema,
    PaymentResponseSchema,
    TransactionsInputSchema,
    TransactionsResponseSchema,
)


class ExtendedOrderStatus(str, Enum):
    CREATED = "created"
    PROCESSED = "processed"
    ACTION_REQUIRED = "action_required"
    PROCESSING = "processing"
    CANCELED = "canceled"
    FAILED = "failed"
    REFUNDED = "refunded"


class ExtendedOrderStatusDetail(str, Enum):
    ACCREDITED = "accredited"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"
    WAITING_CAPTURE = "waiting_capture"
    BAD_FILLED_CARD_DATA = "bad_filled_card_data"
    INVALID_CARD_TOKEN = "invalid_card_token"
    HIGH_RISK = "high_risk"
    REJECTED_BY_ISSUER = "rejected_by_issuer"
    REQUIRED_CALL_FOR_AUTHORIZE = "required_call_for_authorize"
    MAX_ATTEMPTS_EXCEEDED = "max_attempts_exceeded"
    CARD_DISABLED = "card_disabled"
    CARD_INSUFFICIENT_AMOUNT = "card_insufficient_amount"
    AMOUNT_LIMIT_EXCEEDED = "amount_limit_exceeded"
    INVALID_INSTALLMENTS = "invalid_installments"
    PROCESSING_ERROR = "processing_error"
    PENDING_REVIEW_MANUAL = "pending_review_manual"
    IN_PROCESS = "in_process"
    CANCELED = "canceled"
    CANCELED_TRANSACTION = "canceled_transaction"
    SETTLED = "settled"
    REIMBURSED = "reimbursed"


class CreateMPOrderRequest(BaseModel):
    type: OrderType = OrderType.ONLINE
    external_reference: str = Field(..., max_length=150, description="ID do Pedido no seu Banco / UUID")
    transactions: TransactionsInputSchema
    payer: PayerInputSchema
    total_amount: str = Field(..., description="Valor total da Order")
    capture_mode: CaptureMode = CaptureMode.AUTOMATIC
    processing_mode: ProcessingMode = ProcessingMode.AUTOMATIC
    description: Optional[str] = None
    shipment: Optional[ShipmentInputSchema] = None
    items: Optional[List[OrderItemSchema]] = None
    integration_data: Optional[IntegrationDataInputSchema] = None
    config: Optional[OrderConfigInputSchema] = None


class CreateMPOrderResponse(BaseModel):
    id: str = Field(..., description="ID da Order no Mercado Pago (ex: ORD...)")
    type: OrderType
    processing_mode: ProcessingMode
    external_reference: str
    total_amount: str
    total_paid_amount: Optional[str] = "0.00"
    created_date: str
    last_updated_date: str
    country_code: str
    status: OrderStatus
    status_detail: OrderStatusDetail
    capture_mode: CaptureMode
    shipment: Optional[ShipmentInputSchema] = None
    transactions: TransactionsResponseSchema
    description: Optional[str] = None
    items: Optional[List[OrderItemSchema]] = None
    client_token: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class ChargebackResponseSchema(BaseModel):
    id: str
    transaction_id: str
    case_id: str
    status: str
    references: Optional[List[Optional[str]]] = None


class ExtendedTransactionsResponseSchema(BaseModel):
    payments: List[PaymentResponseSchema]
    chargebacks: Optional[List[ChargebackResponseSchema]] = None


class GetMPOrderResponse(BaseModel):
    id: str = Field(..., description="ID da Order no Mercado Pago")
    type: Optional[str] = "online"
    processing_mode: Optional[str] = "automatic"
    external_reference: Optional[str] = Field(None, description="ID do Pedido no seu Banco")
    total_amount: str
    total_paid_amount: Optional[str] = "0.00"
    user_id: Optional[str] = Field(None, description="ID do vendedor/conta MP")
    created_date: str
    last_updated_date: str
    country_code: Optional[str] = "BR"
    status: ExtendedOrderStatus
    status_detail: Optional[ExtendedOrderStatusDetail] = None
    capture_mode: Optional[str] = None
    shipment: Optional[ShipmentInputSchema] = None
    transactions: ExtendedTransactionsResponseSchema
    description: Optional[str] = None
    items: Optional[List[OrderItemSchema]] = None
    expiration_time: Optional[str] = None
    client_token: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class CancelMPOrderResponse(BaseModel):
    id: str = Field(..., description="ID da Order no Mercado Pago")
    type: Optional[str] = "online"
    processing_mode: Optional[str] = "automatic"
    external_reference: Optional[str] = Field(None, description="ID do Pedido na sua aplicação")
    total_amount: str
    user_id: Optional[str] = Field(None, description="ID do vendedor/conta MP")
    created_date: str
    last_updated_date: str
    country_code: Optional[str] = "BR"
    status: ExtendedOrderStatus
    status_detail: Optional[ExtendedOrderStatusDetail] = None
    capture_mode: Optional[str] = None
    description: Optional[str] = None
    transactions: Optional[ExtendedTransactionsResponseSchema] = None
    items: Optional[List[OrderItemSchema]] = None

    model_config = ConfigDict(extra="ignore")
