from datetime import datetime
from typing import List, Literal, Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    model_validator,
)


class CreditTransactionResponse(BaseModel):
    """
    DTO para resposta de uma transação individual no extrato da carteira pré-paga.
    """
    model_config = ConfigDict(from_attributes=True)

    id: str | int = Field(..., description="ID único da transação")
    tenant_id: str = Field(..., description="ID do tenant associado")
    amount: int = Field(..., description="Valor em créditos (positivo para recargas, negativo para consumo)")
    type: Literal["RECHARGE", "USAGE"] = Field(..., description="Tipo da transação: RECHARGE ou USAGE")
    description: Optional[str] = Field(None, description="Descrição detalhada da transação")
    external_payment_id: Optional[str] = Field(None, description="ID de pagamento externo para idempotência (Mercado Pago)")
    created_at: datetime = Field(..., description="Data e hora de criação da transação")


class WalletResponse(BaseModel):
    """
    DTO para resposta com informações do saldo atual da carteira.
    """
    model_config = ConfigDict(from_attributes=True)

    tenant_id: str = Field(..., description="ID do tenant")
    balance_credits: int = Field(..., description="Saldo de créditos disponível")
    updated_at: datetime = Field(..., description="Data da última atualização do saldo")


class WalletStatementResponse(BaseModel):
    """
    DTO para resposta do extrato completo de transações da carteira.
    """
    model_config = ConfigDict(from_attributes=True)

    balance_credits: int = Field(..., description="Saldo atual de créditos na carteira")
    transactions: List[CreditTransactionResponse] = Field(
        default_factory=list, description="Lista das transações registradas"
    )
    total_count: int = Field(..., description="Total de transações cadastradas no histórico")


class RechargeRequest(BaseModel):
    """
    DTO para requisição de recarga de créditos na carteira.
    """
    model_config = ConfigDict(from_attributes=True)

    credits_package: int = Field(
        ..., ge=1, description="Quantidade de créditos a recarregar (ex: 100, 500, 1000)"
    )
    payment_method: Literal["pix", "credit_card"] = Field(
        ..., description="Meio de pagamento escolhido: pix ou credit_card"
    )
    card_token: Optional[str] = Field(
        None, description="Token do cartão de crédito (obrigatório para payment_method == 'credit_card')"
    )
    payer_email: EmailStr = Field(..., description="Endereço de e-mail do pagador")

    @model_validator(mode="after")
    def validate_card_token_presence(self) -> "RechargeRequest":
        if self.payment_method == "credit_card" and not self.card_token:
            raise ValueError("O campo 'card_token' é obrigatório quando o método de pagamento é 'credit_card'.")
        return self


class RechargeResponse(BaseModel):
    """
    DTO para resposta do processamento de pedido de recarga.
    """
    model_config = ConfigDict(from_attributes=True)

    payment_id: str = Field(..., description="ID do pagamento gerado no gateway de pagamento")
    status: str = Field(..., description="Status atual do pagamento (ex: pending, approved)")
    pix_qr_code: Optional[str] = Field(None, description="Imagem em Base64 do QR Code PIX (se PIX)")
    pix_copia_e_cola: Optional[str] = Field(None, description="Código PIX Copia e Cola (se PIX)")
    expiration_date: Optional[datetime] = Field(None, description="Data de expiração do pagamento PIX")


class ConsumeCreditsRequest(BaseModel):
    """
    DTO para requisição de consumo de créditos do saldo do tenant.
    """
    model_config = ConfigDict(from_attributes=True)

    tenant_id: str = Field(..., description="ID do tenant solicitante")
    sku: str = Field(..., description="SKU do produto associado ao consumo de créditos")
    credits_to_consume: int = Field(
        default=1, ge=1, description="Quantidade de créditos a consumir (padrão: 1)"
    )
