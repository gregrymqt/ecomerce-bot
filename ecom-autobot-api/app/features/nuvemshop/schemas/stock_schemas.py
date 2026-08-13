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
