from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class MPIdentificationDTO(BaseModel):
    """Documento de identificação do pagador (CPF/CNPJ)."""
    type: str = Field("CPF", description="Tipo de documento (CPF ou CNPJ)")
    number: str = Field(..., description="Número do documento sem formatação")

    model_config = ConfigDict(extra="ignore")


class MPPayerDTO(BaseModel):
    """Dados do pagador para transações no Mercado Pago."""
    email: EmailStr = Field(..., description="E-mail do pagador")
    first_name: Optional[str] = Field(None, description="Nome do pagador")
    last_name: Optional[str] = Field(None, description="Sobrenome do pagador")
    identification: Optional[MPIdentificationDTO] = Field(None, description="Documento do pagador")

    model_config = ConfigDict(extra="ignore")


class MPPaymentCreateRequest(BaseModel):
    """Payload estrito de requisição de pagamento (PIX ou Cartão de Crédito)."""
    transaction_amount: float = Field(..., gt=0, description="Valor total da transação em BRL")
    token: Optional[str] = Field(None, description="Token do cartão de crédito (opcional para PIX)")
    description: str = Field(..., description="Descrição da compra/serviço")
    installments: int = Field(1, ge=1, description="Número de parcelas")
    payment_method_id: str = Field(..., description="Bandeira do cartão ou 'pix'")
    payer: MPPayerDTO = Field(..., description="Informações do pagador")
    notification_url: Optional[str] = Field(None, description="URL de Webhook customizada")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Metadados adicionais (tenant_id, order_id)")

    model_config = ConfigDict(extra="ignore")


class MPPaymentResponse(BaseModel):
    """Resposta padronizada de criação/consulta de pagamento no Mercado Pago."""
    id: int = Field(..., description="ID da transação no Mercado Pago")
    status: str = Field(..., description="Status do pagamento (approved, pending, rejected, etc.)")
    status_detail: Optional[str] = Field(None, description="Detalhes adicionais do status")
    payment_method_id: Optional[str] = None
    transaction_amount: Optional[float] = None
    point_of_interaction: Optional[Dict[str, Any]] = Field(
        None, description="Dados do QR Code / PIX Copia e Cola (para pagamentos PIX)"
    )

    model_config = ConfigDict(extra="ignore")


class MPPreapprovalRequest(BaseModel):
    """Payload para criação de assinaturas recorrentes (Preapproval)."""
    preapproval_plan_id: str = Field(..., description="ID do plano recorrente no Mercado Pago")
    reason: str = Field(..., description="Título da assinatura")
    payer_email: EmailStr = Field(..., description="E-mail do assinante")
    card_token_id: Optional[str] = Field(None, description="Token do cartão para cobrança automática")
    auto_recurring: Optional[Dict[str, Any]] = Field(None, description="Regras de recorrência")
    back_url: Optional[str] = Field(None, description="URL de retorno pós-assinatura")

    model_config = ConfigDict(extra="ignore")


class MPPreapprovalResponse(BaseModel):
    """Resposta padronizada de assinatura recorrente no Mercado Pago."""
    id: str = Field(..., description="ID da assinatura no Mercado Pago")
    status: str = Field(..., description="Status da assinatura (authorized, pending, cancelled, paused)")
    payer_email: Optional[str] = None
    preapproval_plan_id: Optional[str] = None

    model_config = ConfigDict(extra="ignore")
