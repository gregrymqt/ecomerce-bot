from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.features.checkout.schemas.order import (
    ExtendedOrderStatus,
    ExtendedOrderStatusDetail,
)


class RefundTransactionInputSchema(BaseModel):
    id: str = Field(..., description="ID da transação/pagamento (ex: PAY01J67...)")
    amount: str = Field(..., description="Valor a ser reembolsado (ex: '24.50')")


class RefundMPOrderRequest(BaseModel):
    transactions: Optional[List[RefundTransactionInputSchema]] = Field(
        None, description="Lista com a transação e valor para reembolso parcial. Se omitido/None, realiza Reembolso Total."
    )


class RefundItemResponseSchema(BaseModel):
    id: str = Field(..., description="ID do reembolso gerado pelo Mercado Pago")
    transaction_id: str = Field(..., description="ID da transação original")
    reference_id: Optional[str] = None
    amount: str = Field(..., description="Valor efetivamente reembolsado")
    status: str = Field(..., example="processed")
    e2e_id: Optional[str] = Field(None, description="ID End-to-End da devolução PIX (se aplicável)")


class RefundTransactionsResponseSchema(BaseModel):
    refunds: List[RefundItemResponseSchema]


class RefundMPOrderResponse(BaseModel):
    id: str = Field(..., description="ID da Order no Mercado Pago")
    status: ExtendedOrderStatus
    status_detail: ExtendedOrderStatusDetail
    transactions: Optional[RefundTransactionsResponseSchema] = None

    model_config = ConfigDict(extra="ignore")
