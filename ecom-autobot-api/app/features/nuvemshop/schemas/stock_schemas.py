from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, field_validator


class NuvemshopLocationAddress(BaseModel):
    """Endereço físico de um depósito/localização na Nuvemshop."""
    zipcode: Optional[str] = None
    street: Optional[str] = None
    number: Optional[str] = None
    locality: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    country: Optional[str] = None


class NuvemshopLocationResponse(BaseModel):
    """DTO de resposta representando um depósito/localização na API da Nuvemshop."""
    id: str = Field(..., description="ID único do depósito na Nuvemshop")
    name: Dict[str, str] = Field(default_factory=dict, description="Nome da localização (dicionário de idiomas ex: {'pt': 'Depósito Principal'})")
    store_id: str = Field(..., description="ID da loja na Nuvemshop")
    is_default: bool = Field(False, description="Indica se este é o depósito padrão da loja")
    priority: int = Field(0, description="Prioridade de envio do depósito")
    address: Optional[NuvemshopLocationAddress] = Field(None, description="Endereço físico do depósito")
    tags: List[str] = Field(default_factory=list, description="Lista de tags associadas ao depósito")

    @field_validator("id", "store_id", mode="before")
    @classmethod
    def coerce_to_string(cls, v: Any) -> str:
        if v is None:
            return ""
        return str(v)


class InventoryLevelSchema(BaseModel):
    """DTO representando a quantidade em estoque de uma variante por depósito."""
    id: str = Field(..., description="ID único do registro de estoque")
    variant_id: str = Field(..., description="ID da variante de produto")
    location_id: str = Field(..., description="ID do depósito/localização")
    stock: int = Field(0, description="Quantidade física em estoque no depósito")

    @field_validator("id", "variant_id", "location_id", mode="before")
    @classmethod
    def coerce_to_string(cls, v: Any) -> str:
        if v is None:
            return ""
        return str(v)


class NuvemshopInventoryLevelItem(BaseModel):
    """Item detalhado do nível de estoque da variante em determinado depósito."""
    id: str = Field(..., description="ID único do nível de estoque")
    variant_id: str = Field(..., description="ID da variante na Nuvemshop")
    location_id: str = Field(..., description="ID da localização/depósito")
    stock: int = Field(0, description="Quantidade em estoque")
    created_at: Optional[str] = Field(None, description="Data de criação do registro")
    updated_at: Optional[str] = Field(None, description="Data da última atualização")

    @field_validator("id", "variant_id", "location_id", mode="before")
    @classmethod
    def coerce_to_string(cls, v: Any) -> str:
        if v is None:
            return ""
        return str(v)


class NuvemshopInventoryLevelListResponse(BaseModel):
    """Resposta paginada da consulta de níveis de estoque por depósito."""
    total: int = Field(0, description="Total de registros encontrados")
    page: int = Field(1, description="Página atual")
    per_page: int = Field(10, description="Registros por página")
    results: List[NuvemshopInventoryLevelItem] = Field(default_factory=list, description="Lista de saldos de estoque por localização")


class NuvemshopStockUpdateItem(BaseModel):
    """Item de atualização de estoque para variante em depósito."""
    variant_id: str = Field(..., description="ID da variante de produto na Nuvemshop")
    stock: int = Field(..., description="Nova quantidade de estoque para a variante")

    @field_validator("variant_id", mode="before")
    @classmethod
    def coerce_to_string(cls, v: Any) -> str:
        if v is None:
            return ""
        return str(v)


class NuvemshopStockUpdateBatchRequest(BaseModel):
    """Payload para atualização em lote de saldos de estoque por depósito."""
    items: List[NuvemshopStockUpdateItem] = Field(..., description="Lista de atualizações de estoque por variante")
