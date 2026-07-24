from typing import Union
from typing import List
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class FrequencyTypeEnum(str, Enum):
    DAYS = "days"
    MONTHS = "months"


class SubscriptionStatusEnum(str, Enum):
    PENDING = "pending"
    AUTHORIZED = "authorized"
    PAUSED = "paused"
    CANCELLED = "cancelled"


class FreeTrialDTO(BaseModel):
    frequency: int = Field(..., gt=0, description="Quantidade de períodos gratuitos")
    frequency_type: FrequencyTypeEnum = Field(..., description="Unidade do ciclo de teste (days/months)")


class AutoRecurringDTO(BaseModel):
    frequency: int = Field(..., gt=0, description="Frequência do ciclo de cobrança")
    frequency_type: FrequencyTypeEnum = Field(..., description="Unidade do ciclo (days/months)")
    transaction_amount: float = Field(..., gt=0, description="Valor cobrado em cada ciclo")
    currency_id: str = Field(default="BRL", description="Moeda (ex: BRL, ARS)")
    start_date: Optional[datetime] = Field(None, description="Data de início da cobrança")
    end_date: Optional[datetime] = Field(None, description="Data de término da cobrança")
    free_trial: Optional[FreeTrialDTO] = Field(None, description="Configuração do período de teste gratuito")


# --------------------------------------------------------------------
# Requests da nossa API Central
# --------------------------------------------------------------------

class CreateSubscriptionRequest(BaseModel):
    preapproval_plan_id: Optional[str] = Field(
        None, description="ID do plano no Mercado Pago (external_id local). Opcional para assinaturas avulsas."
    )
    reason: Optional[str] = Field(
        None, description="Descrição curta exibida na fatura/checkout. Obrigatório para assinaturas sem plano."
    )
    external_reference: Optional[str] = Field(
        None, description="Referência externa para sincronização com nosso banco/tenant."
    )
    payer_email: str = Field(..., description="E-mail do assinante (usado para vincular o pagador no MP).")
    card_token_id: Optional[str] = Field(
        None, description="Token seguro do cartão gerado no Checkout Transparente."
    )
    auto_recurring: Optional[AutoRecurringDTO] = Field(
        None, description="Dados de recorrência (obrigatório se preapproval_plan_id não for informado)."
    )
    back_url: Optional[str] = Field(
        None, description="URL de retorno para o cliente após a conclusão do checkout."
    )
    status: Optional[SubscriptionStatusEnum] = Field(
        default=SubscriptionStatusEnum.PENDING, description="Status inicial da assinatura."
    )


class UpdateSubscriptionRequest(BaseModel):
    reason: Optional[str] = Field(None, description="Nova descrição da assinatura.")
    card_token_id: Optional[str] = Field(None, description="Novo token de cartão de crédito para atualizar forma de pagamento.")
    auto_recurring: Optional[AutoRecurringDTO] = Field(None, description="Atualização nas configurações de recorrência.")
    back_url: Optional[str] = Field(None, description="Nova URL de retorno pós-checkout.")
    status: Optional[SubscriptionStatusEnum] = Field(None, description="Novo status (ex: paused, cancelled, authorized).")


class SearchSubscriptionsQueryParams(BaseModel):
    page: int = Field(default=1, ge=1, description="Número da página para paginação.")
    limit: int = Field(default=10, ge=1, le=100, description="Quantidade de itens por página.")
    status: Optional[SubscriptionStatusEnum] = Field(None, description="Filtrar por status.")
    payer_email: Optional[str] = Field(None, description="Filtrar por e-mail do assinante.")
    preapproval_plan_id: Optional[str] = Field(None, description="Filtrar por plano vinculado.")


# --------------------------------------------------------------------
# DTO de Integração Direta com a API Mercado Pago (/preapproval)
# --------------------------------------------------------------------

class MercadoPagoPreapprovalResponse(BaseModel):
    id: str = Field(..., description="ID da assinatura no Mercado Pago (preapproval_id).")
    version: Optional[int] = 0
    application_id: Optional[int] = None
    collector_id: Optional[int] = None
    preapproval_plan_id: Optional[str] = None
    reason: Optional[str] = None
    external_reference: Optional[str] = None
    back_url: Optional[str] = None
    init_point: Optional[str] = Field(None, description="URL para o cliente cadastrar/alterar o cartão via Checkout MP.")
    auto_recurring: Optional[AutoRecurringDTO] = None
    payer_id: Optional[int] = None
    payer_email: Optional[str] = None
    card_id: Optional[str] = None
    payment_method_id: Optional[str] = None
    next_payment_date: Optional[datetime] = None
    date_created: Optional[datetime] = None
    last_modified: Optional[datetime] = None
    status: SubscriptionStatusEnum

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------
# Response Serializada da nossa API Central
# --------------------------------------------------------------------

class SubscriptionResponse(BaseModel):
    id: str = Field(..., description="ID interno da assinatura (UUID).")
    tenant_id: str = Field(..., description="Identificador do Tenant.")
    plan_id: Optional[str] = Field(None, description="ID do plano interno cadastrado na tabela de plans.")
    preapproval_id: str = Field(..., description="ID único da assinatura no Mercado Pago.")
    payer_email: str
    status: SubscriptionStatusEnum
    reason: Optional[str] = None
    external_reference: Optional[str] = None
    init_point: Optional[str] = None
    payment_method_id: Optional[str] = None
    card_id: Optional[str] = None
    next_payment_date: Optional[datetime] = None
    auto_recurring: Optional[Dict[str, Any]] = Field(None, description="Payload de configurações de recorrência gravado.")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)



# --------------------------------------------------------------------
# DTOs para Busca e Paginação no Mercado Pago
# --------------------------------------------------------------------

class PagingDTO(BaseModel):
    offset: int = Field(default=0, ge=0, description="Índice inicial dos resultados.")
    limit: int = Field(default=20, ge=1, le=100, description="Limite de registros retornados por página.")
    total: int = Field(default=0, ge=0, description="Total acumulado de registros encontrados.")


class SummarizedDTO(BaseModel):
    quotas: Optional[int] = Field(None, description="Total de parcelas/cobranças previstas.")
    charged_quantity: Optional[int] = Field(None, description="Quantidade de parcelas já cobradas.")
    charged_amount: Optional[float] = Field(None, description="Valor total cobrado até o momento.")
    pending_charge_quantity: Optional[int] = Field(None, description="Quantidade de parcelas pendentes.")
    pending_charge_amount: Optional[float] = Field(None, description="Valor pendente de cobrança.")
    last_charged_date: Optional[datetime] = Field(None, description="Data da última cobrança realizada.")
    last_charged_amount: Optional[float] = Field(None, description="Valor da última cobrança realizada.")
    semaphore: Optional[str] = Field(
        None, description="Status consolidado de cobrança: green, yellow, red ou blank."
    )


class MercadoPagoSearchQueryParams(BaseModel):
    q: Optional[str] = Field(None, description="Texto livre para pesquisa.")
    payer_id: Optional[int] = Field(None, description="ID do pagador no Mercado Pago.")
    payer_email: Optional[str] = Field(None, description="E-mail do assinante.")
    preapproval_plan_id: Optional[str] = Field(None, description="ID do plano vinculado.")
    transaction_amount: Optional[float] = Field(None, description="Valor exato da assinatura.")
    semaphore: Optional[str] = Field(None, description="Filtro por semáforo de cobrança (green, yellow, red).")
    status: Optional[str] = Field(None, description="Filtro por status (pending, authorized, paused, cancelled).")
    sort: Optional[str] = Field(None, description="Ordenação no formato 'campo:tipo' (ex: date_created:desc).")
    offset: int = Field(default=0, ge=0, description="Deslocamento inicial para paginação.")
    limit: int = Field(default=20, ge=1, le=100, description="Quantidade de itens por página.")


# Extensão do DTO de Resposta da Assinatura com campos extras retornados na busca
class MercadoPagoPreapprovalItemResponse(MercadoPagoPreapprovalResponse):
    payer_first_name: Optional[str] = None
    payer_last_name: Optional[str] = None
    first_invoice_offset: Optional[int] = None
    card_id_secondary: Optional[Union[str, int]] = None
    payment_method_id_secondary: Optional[str] = None
    summarized: Optional[SummarizedDTO] = None


class MercadoPagoSearchSubscriptionsResponse(BaseModel):
    paging: PagingDTO
    results: List[MercadoPagoPreapprovalItemResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

# --------------------------------------------------------------------
# DTOs para Update no Mercado Pago
# --------------------------------------------------------------------

class UpdateAutoRecurringDTO(BaseModel):
    transaction_amount: Optional[float] = Field(None, gt=0, description="Novo valor a ser cobrado a cada ciclo.")
    currency_id: Optional[str] = Field(None, description="ID da moeda (ex: BRL).")


class MercadoPagoUpdatePreapprovalRequest(BaseModel):
    reason: Optional[str] = Field(None, description="Nova descrição da assinatura.")
    external_reference: Optional[Union[str, int]] = Field(
        None, description="Nova referência externa para sincronização."
    )
    back_url: Optional[str] = Field(None, description="Nova URL de retorno pós-checkout.")
    auto_recurring: Optional[UpdateAutoRecurringDTO] = Field(
        None, description="Alteração nos valores de recorrência."
    )
    card_token_id: Optional[Union[str, int]] = Field(
        None, description="Novo token de cartão de crédito primário."
    )
    card_token_id_secondary: Optional[Union[str, int]] = Field(
        None, description="Token de cartão para forma de pagamento secundária."
    )
    payment_method_id_secondary: Optional[str] = Field(
        None, description="Identificador do meio de pagamento secundário (ex: visa)."
    )
    status: Optional[SubscriptionStatusEnum] = Field(
        None, description="Novo status da assinatura (pending, authorized, paused, cancelled)."
    )
