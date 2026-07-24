from typing import List, Optional
from pydantic import BaseModel, Field

from app.features.checkout.enums import (
    LiabilityShift,
    OrderStatus,
    OrderStatusDetail,
    PaymentMethodId,
    PaymentMethodType,
    ThreeDSValidation,
)


class TransactionSecurityInputSchema(BaseModel):
    validation: ThreeDSValidation = ThreeDSValidation.NEVER
    liability_shift: Optional[LiabilityShift] = None


class OrderConfigOnlineInputSchema(BaseModel):
    transaction_security: Optional[TransactionSecurityInputSchema] = None
    callback_url: Optional[str] = None


class OrderConfigInputSchema(BaseModel):
    online: Optional[OrderConfigOnlineInputSchema] = None


class PaymentMethodInputSchema(BaseModel):
    id: PaymentMethodId
    type: PaymentMethodType
    token: Optional[str] = Field(None, min_length=32, max_length=33, description="Token do Cartão de Crédito")
    installments: Optional[int] = Field(1, ge=1)
    statement_descriptor: Optional[str] = Field(None, max_length=50)


class PaymentInputSchema(BaseModel):
    amount: str = Field(..., description="Valor da transação formatado com até 2 casas decimais")
    payment_method: PaymentMethodInputSchema
    expiration_time: Optional[str] = Field(None, description="Formato ISO 8601 ex: P1D")
    date_of_expiration: Optional[str] = None


class TransactionsInputSchema(BaseModel):
    payments: PaymentInputSchema


class PaymentMethodResponseSchema(BaseModel):
    id: Optional[str] = None
    type: Optional[str] = None
    token: Optional[str] = None
    installments: Optional[int] = None
    statement_descriptor: Optional[str] = None
    ticket_url: Optional[str] = Field(None, description="URL do Boleto/Comprovante")
    barcode_content: Optional[str] = Field(None, description="Código de barras boleto")
    digitable_line: Optional[str] = Field(None, description="Linha digitável do boleto")
    qr_code: Optional[str] = Field(None, description="Chave 'Copia e Cola' do PIX")
    qr_code_base64: Optional[str] = Field(None, description="Imagem em Base64 do QR Code PIX")
    e2e_id: Optional[str] = Field(None, description="ID End-to-End da transação PIX")


class PaymentResponseSchema(BaseModel):
    id: str
    amount: str
    paid_amount: Optional[str] = None
    reference_id: Optional[str] = None
    status: OrderStatus
    status_detail: OrderStatusDetail
    expiration_time: Optional[str] = None
    date_of_expiration: Optional[str] = None
    payment_method: Optional[PaymentMethodResponseSchema] = None


class TransactionsResponseSchema(BaseModel):
    payments: List[PaymentResponseSchema]
