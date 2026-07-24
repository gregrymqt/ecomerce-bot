from datetime import datetime
from typing import Dict, List, Optional, Union
from pydantic import BaseModel, Field, HttpUrl, SecretStr

ProductAttributeValue = Union[str, int, float, bool, List[str]]


class ScrapedProductResult(BaseModel):
    title: Optional[str] = Field(None, description="Nome ou título do produto extraído")
    description: Optional[str] = Field(None, description="Descrição detalhada do produto")
    price: Optional[str] = Field(None, description="Preço do produto como string")
    currency: Optional[str] = Field(None, description="Moeda do preço (ex: BRL, USD)")
    image_url: Optional[str] = Field(None, description="URL da imagem principal")
    sku: Optional[str] = Field(None, description="Código SKU ou identificador único")


class AICredentialsRequest(BaseModel):
    tenant_id: str = Field(..., description="ID do tenant (isolamento)")
    provider: str = Field(..., description="Nome do provedor de IA (ex: openai, gemini)")
    access_token: SecretStr = Field(..., description="Chave de API token do provedor")


class WebScraperRequest(BaseModel):
    tenant_id: str = Field(..., description="ID do tenant (isolamento)")
    url: HttpUrl = Field(..., description="URL da página do catálogo ou produto para extração")


class ImportRequestMessage(BaseModel):
    product_id: str = Field(..., alias="ProductId")
    tenant_id: str = Field(..., alias="TenantId")
    target_url: str = Field(..., alias="TargetUrl")

    class Config:
        populate_by_name = True


class ImportCompletedMessage(BaseModel):
    success: bool = Field(..., alias="Success")
    product_id: str = Field(..., alias="ProductId")
    tenant_id: str = Field(..., alias="TenantId")
    error: Optional[str] = Field(None, alias="Error")

    title: Optional[str] = Field(None, alias="Title")
    description: Optional[str] = Field(None, alias="Description")
    price: Optional[float] = Field(None, alias="Price")
    images: Optional[List[str]] = Field(default_factory=list, alias="Images")
    attributes: Optional[Dict[str, ProductAttributeValue]] = Field(default_factory=dict, alias="Attributes")

    class Config:
        populate_by_name = True
