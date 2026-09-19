from uuid import UUID
from typing import Optional, List, Dict
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


class ScrapedRawProductEvent(BaseModel):
    """
    Contrato da fase intermediária publicado em ecommerce_scraped_queue após scraping perimetral.
    Consumido pelo Core C# (ScrapedProductConsumer) para orquestração de LLM (OpenRouter),
    copywriting persuasivo, SEO estruturado e persistência.
    """
    model_config = ConfigDict(populate_by_name=True)

    tenant_id: UUID = Field(
        ...,
        validation_alias=AliasChoices("tenantId", "TenantId", "tenant_id"),
        serialization_alias="tenantId",
        description="Identificador único do tenant proprietário do evento.",
    )
    sku: str = Field(
        default="",
        validation_alias=AliasChoices("sku", "Sku", "productId", "ProductId", "product_id"),
        serialization_alias="sku",
        description="SKU ou identificador único do produto.",
    )
    url: str = Field(
        default="",
        validation_alias=AliasChoices("url", "Url", "targetUrl", "TargetUrl", "target_url"),
        serialization_alias="url",
        description="URL pública do produto que foi raspado.",
    )
    raw_title: str = Field(
        default="",
        validation_alias=AliasChoices("rawTitle", "RawTitle", "raw_title", "title", "Title"),
        serialization_alias="rawTitle",
        description="Título bruto extraído do DOM ou meta-tags.",
    )
    raw_description_html: str = Field(
        default="",
        validation_alias=AliasChoices("rawDescriptionHtml", "RawDescriptionHtml", "raw_description_html"),
        serialization_alias="rawDescriptionHtml",
        description="Conteúdo HTML bruto ou sanitizado do produto.",
    )
    raw_markdown: str = Field(
        default="",
        validation_alias=AliasChoices("rawMarkdown", "RawMarkdown", "raw_markdown"),
        serialization_alias="rawMarkdown",
        description="Conteúdo convertido em Markdown limpo para a LLM.",
    )
    price: Optional[float] = Field(
        default=None,
        validation_alias=AliasChoices("price", "Price"),
        serialization_alias="price",
        description="Preço numérico do produto se identificado.",
    )
    currency: str = Field(
        default="BRL",
        validation_alias=AliasChoices("currency", "Currency"),
        serialization_alias="currency",
        description="Moeda do produto (BRL, USD, etc.).",
    )
    images: List[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("images", "Images"),
        serialization_alias="images",
        description="Lista de URLs de imagens do produto extraídas.",
    )
    meta_attributes: Dict[str, str] = Field(
        default_factory=dict,
        validation_alias=AliasChoices("metaAttributes", "MetaAttributes", "meta_attributes"),
        serialization_alias="metaAttributes",
        description="Atributos adicionais e metadados extraídos (marca, categoria, etc.).",
    )
    prompt_context: str = Field(
        default="",
        validation_alias=AliasChoices("promptContext", "PromptContext", "prompt_context"),
        serialization_alias="promptContext",
        description="Contexto adicional ou tom desejado para a LLM.",
    )
    success: bool = Field(
        default=True,
        validation_alias=AliasChoices("success", "Success"),
        serialization_alias="success",
        description="Indica se a etapa de scraping perimetral foi concluída com sucesso.",
    )
    error_message: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("errorMessage", "ErrorMessage", "error_message"),
        serialization_alias="errorMessage",
        description="Mensagem detalhada em caso de falha de scraping ou validação.",
    )

