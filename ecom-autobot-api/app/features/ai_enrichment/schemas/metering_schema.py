from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class LLMUsageLogCreate(BaseModel):
    """Schema interno para gravação de log de uso de LLM após a execução."""

    tenant_id: str = Field(..., description="Identificador do tenant.")
    product_id: Optional[str] = Field(None, description="ID do produto associado (opcional).")
    provider: str = Field(..., description="Provedor de LLM utilizado (ex: 'openrouter', 'deepseek', 'groq', 'gemini').")
    model_used: str = Field(..., description="Identificador exato do modelo utilizado.")
    prompt_tokens: int = Field(default=0, ge=0, description="Quantidade de tokens no prompt.")
    completion_tokens: int = Field(default=0, ge=0, description="Quantidade de tokens na resposta.")
    total_tokens: int = Field(default=0, ge=0, description="Total de tokens consumidos na requisição.")
    estimated_cost_usd: Decimal = Field(
        default=Decimal("0.000000"),
        description="Custo estimado em USD da chamada."
    )
    is_byok: bool = Field(
        default=False,
        description="Indica se a requisição utilizou chave própria do tenant (BYOK)."
    )
    execution_time_ms: Optional[int] = Field(
        None, ge=0, description="Tempo total de execução em milissegundos."
    )


class LLMUsageLogResponse(BaseModel):
    """DTO de resposta para extrato de consumo de LLM pelo tenant."""

    id: str = Field(..., description="UUID do registro de consumo.")
    tenant_id: str = Field(..., description="Identificador do tenant.")
    product_id: Optional[str] = Field(None, description="ID do produto associado (se houver).")
    provider: str = Field(..., description="Provedor de LLM.")
    model_used: str = Field(..., description="Modelo de LLM utilizado.")
    prompt_tokens: int = Field(..., description="Tokens de prompt.")
    completion_tokens: int = Field(..., description="Tokens de resposta.")
    total_tokens: int = Field(..., description="Total de tokens.")
    estimated_cost_usd: Decimal = Field(..., description="Custo estimado em USD.")
    is_byok: bool = Field(..., description="Modo BYOK ativado na chamada.")
    execution_time_ms: Optional[int] = Field(None, description="Tempo de execução em ms.")
    created_at: datetime = Field(..., description="Data/hora do registro de uso.")

    model_config = ConfigDict(from_attributes=True)


class TenantCreditBalanceResponse(BaseModel):
    """DTO para exibição de saldo de créditos, consumo mensal e status da conta do tenant."""

    tenant_id: str = Field(..., description="Identificador do tenant.")
    managed_credit_balance: Decimal = Field(
        ..., description="Saldo restante de créditos gerenciados em USD."
    )
    monthly_total_tokens: int = Field(
        default=0, description="Total de tokens consumidos no mês corrente."
    )
    monthly_total_cost_usd: Decimal = Field(
        default=Decimal("0.000000"),
        description="Custo total estimado em USD no mês corrente."
    )
    is_byok_enabled: bool = Field(
        default=False,
        description="Indica se o tenant possui chaves próprias (BYOK) configuradas."
    )
    active_mode: str = Field(
        default="managed",
        description="Modo ativo de roteamento de IA ('byok' ou 'managed')."
    )

    model_config = ConfigDict(from_attributes=True)


class TokenEstimateRequest(BaseModel):
    """DTO para pré-checagem de tokens antes de disparar batches de scraping/enriquecimento."""

    tenant_id: str = Field(..., description="Identificador do tenant.")
    estimated_products_count: int = Field(
        ..., gt=0, description="Quantidade de produtos no lote a ser processado."
    )
    model_target: Optional[str] = Field(
        None, description="Modelo alvo de IA para cálculo de estimativa (opcional)."
    )
    average_tokens_per_product: int = Field(
        default=1500, gt=0, description="Média estimada de tokens consumidos por produto."
    )


class PaginatedLLMUsageLogResponse(BaseModel):
    """DTO paginado para o extrato de consumo de tokens do tenant no endpoint GET /usage."""

    items: List[LLMUsageLogResponse] = Field(..., description="Lista de registros de uso na página atual.")
    total: int = Field(..., ge=0, description="Total de registros correspondentes ao filtro.")
    page: int = Field(..., ge=1, description="Número da página atual.")
    limit: int = Field(..., ge=1, description="Quantidade de itens por página.")
    total_pages: int = Field(..., ge=1, description="Total de páginas disponíveis.")

    model_config = ConfigDict(from_attributes=True)
