from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field

from app.features.checkout.enums import PaymentMethodId, OrderStatus, OrderStatusDetail
from app.features.checkout.schemas.common import AddressSchema, OrderItemSchema


class CustomerDTO(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    document_type: str = Field(..., example="CPF")
    document_number: str = Field(..., example="19119119100")


# --- INPUTS ---

class CreatePixCheckoutInput(BaseModel):
    external_reference: str = Field(..., description="ID do Pedido no seu sistema/banco")
    total_amount: Decimal
    customer: CustomerDTO
    shipping_address: Optional[AddressSchema] = None
    items: List[OrderItemSchema]
    expiration_time_iso: Optional[str] = Field("P1D", description="Duração do PIX no padrão ISO 8601 (ex: P1D = 1 dia)")


class CreateCreditCardCheckoutInput(BaseModel):
    external_reference: str = Field(..., description="ID do Pedido no seu sistema/banco")
    total_amount: Decimal
    card_token: str = Field(..., min_length=32, max_length=33, description="Token do cartão gerado no Frontend")
    payment_method_id: PaymentMethodId = Field(..., description="visa, master, debelo, etc.")
    installments: int = Field(1, ge=1, description="Número de parcelas")
    statement_descriptor: Optional[str] = Field(None, max_length=50, description="Nome na fatura do cartão")
    customer: CustomerDTO
    shipping_address: Optional[AddressSchema] = None
    items: List[OrderItemSchema]


# --- OUTPUTS ---

class CheckoutResultOutput(BaseModel):
    order_id: str
    mp_order_id: str
    external_reference: str
    status: OrderStatus
    status_detail: Optional[OrderStatusDetail] = None
    total_amount: Decimal
    
    # Campos específicos para PIX
    pix_qr_code: Optional[str] = None
    pix_qr_code_base64: Optional[str] = None
    pix_expiration_date: Optional[datetime] = None
    
    # Campos específicos para Cartão / Boleto
    ticket_url: Optional[str] = None