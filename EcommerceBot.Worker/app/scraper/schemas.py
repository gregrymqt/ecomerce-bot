from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, Field, AliasChoices, ConfigDict


class ScrapingRequest(BaseModel):
    """
    Contrato fortemente tipado da mensagem de solicitação de Scraping.
    Suporta campos canônicos (sku, url) e compatibilidade com aliases legados (productId, targetUrl).
    """
    model_config = ConfigDict(populate_by_name=True)

    tenant_id: UUID = Field(
        ...,
        validation_alias=AliasChoices("tenantId", "TenantId", "tenant_id"),
        serialization_alias="tenantId",
        description="Identificador único do tenant.",
    )
    sku: str = Field(
        ...,
        validation_alias=AliasChoices("sku", "Sku", "productId", "ProductId", "product_id"),
        serialization_alias="sku",
        description="SKU ou identificador da requisição de extração.",
    )
    url: str = Field(
        ...,
        validation_alias=AliasChoices("url", "Url", "targetUrl", "TargetUrl", "target_url"),
        serialization_alias="url",
        description="URL pública do produto a ser raspado.",
    )
    prompt_context: str = Field(
        default="",
        validation_alias=AliasChoices("promptContext", "PromptContext", "prompt_context"),
        serialization_alias="promptContext",
        description="Instruções ou contexto adicional de prompt para a LLM.",
    )
    is_byok: bool = Field(
        default=False,
        validation_alias=AliasChoices("isByok", "IsByok", "is_byok"),
        serialization_alias="isByok",
        description="Indica se o tenant está utilizando chave própria de IA.",
    )


class ProductEnrichmentMetadata(BaseModel):
    """
    Metadados estruturados resultantes da extração e enriquecimento do produto.
    """
    model_config = ConfigDict(populate_by_name=True)

    price: Optional[float] = Field(default=None, description="Preço numérico extraído do produto.")
    brand: Optional[str] = Field(default=None, description="Marca ou fabricante identificado.")
    category: Optional[str] = Field(default=None, description="Categoria do produto.")
    model_used: str = Field(
        default="scrapling/adaptive-dom",
        validation_alias=AliasChoices("model_used", "modelUsed"),
        serialization_alias="model_used",
        description="Modelo ou estratégia utilizada na extração.",
    )
    images: List[str] = Field(
        default_factory=list,
        description="Lista de URLs de imagens do produto extraídas.",
    )


class ProductProcessedEvent(BaseModel):
    """
    Evento de retorno publicado em ecommerce_processed_queue consumido pelo C# ProcessedProductConsumer.
    """
    model_config = ConfigDict(populate_by_name=True)

    tenant_id: UUID = Field(
        ...,
        validation_alias=AliasChoices("tenantId", "TenantId", "tenant_id"),
        serialization_alias="tenantId",
        description="Identificador do tenant proprietário do evento.",
    )
    sku: str = Field(..., description="SKU ou identificador da requisição.")
    title: str = Field(default="", description="Título enriquecido do produto.")
    description: str = Field(default="", description="Descrição comercial e enriquecida.")
    status: str = Field(default="PROCESSED", description="Status do processamento: PROCESSED ou FAILED.")
    is_fallback: bool = Field(
        default=False,
        validation_alias=AliasChoices("isFallback", "IsFallback", "is_fallback"),
        serialization_alias="isFallback",
        description="Indica se o resultado foi gerado via fallback.",
    )
    error_message: str = Field(
        default="",
        validation_alias=AliasChoices("errorMessage", "ErrorMessage", "error_message"),
        serialization_alias="errorMessage",
        description="Mensagem de erro detalhada em caso de falha.",
    )
    ai_metadata_json: str = Field(
        default="{}",
        validation_alias=AliasChoices("aiMetadataJson", "AiMetadataJson", "ai_metadata_json"),
        serialization_alias="aiMetadataJson",
        description="JSON serializado contendo os metadados do enriquecimento.",
    )


class LlmUsageEvent(BaseModel):
    """
    Evento de telemetria e consumo de tokens publicado em llm_usage_queue consumido pelo C# LlmUsageConsumer.
    """
    model_config = ConfigDict(populate_by_name=True)

    tenant_id: UUID = Field(
        ...,
        validation_alias=AliasChoices("tenantId", "TenantId", "tenant_id"),
        serialization_alias="tenantId",
        description="Identificador único do tenant.",
    )
    product_id: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("productId", "ProductId", "sku", "product_id"),
        serialization_alias="productId",
        description="SKU ou identificador do produto associado.",
    )
    provider: str = Field(default="openrouter", description="Provedor de inferência de IA.")
    model_used: str = Field(
        default="deepseek/deepseek-chat",
        validation_alias=AliasChoices("modelUsed", "ModelUsed", "model_used"),
        serialization_alias="modelUsed",
        description="Modelo de LLM executado.",
    )
    prompt_tokens: int = Field(
        default=0,
        validation_alias=AliasChoices("promptTokens", "PromptTokens", "prompt_tokens"),
        serialization_alias="promptTokens",
        description="Tokens de prompt consumidos.",
    )
    completion_tokens: int = Field(
        default=0,
        validation_alias=AliasChoices("completionTokens", "CompletionTokens", "completion_tokens"),
        serialization_alias="completionTokens",
        description="Tokens de completude consumidos.",
    )
    total_tokens: int = Field(
        default=0,
        validation_alias=AliasChoices("totalTokens", "TotalTokens", "total_tokens"),
        serialization_alias="totalTokens",
        description="Total de tokens consumidos.",
    )
    estimated_cost_usd: float = Field(
        default=0.0,
        validation_alias=AliasChoices("estimatedCostUsd", "EstimatedCostUsd", "estimated_cost_usd"),
        serialization_alias="estimatedCostUsd",
        description="Custo estimado em USD da inferência.",
    )
    is_byok: bool = Field(
        default=False,
        validation_alias=AliasChoices("isByok", "IsByok", "is_byok"),
        serialization_alias="isByok",
        description="Indica se foi utilizado token BYOK.",
    )
    execution_time_ms: int = Field(
        default=0,
        validation_alias=AliasChoices("executionTimeMs", "ExecutionTimeMs", "execution_time_ms"),
        serialization_alias="executionTimeMs",
        description="Tempo total de execução em milissegundos.",
    )
    reserved_cost: Optional[float] = Field(
        default=None,
        validation_alias=AliasChoices("reservedCost", "ReservedCost", "reserved_cost"),
        serialization_alias="reservedCost",
        description="Custo reservado previamente, se aplicável.",
    )
