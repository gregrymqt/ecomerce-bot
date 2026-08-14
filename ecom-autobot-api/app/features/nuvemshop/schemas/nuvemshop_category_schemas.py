from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class NuvemshopCategoryCreatePayload(BaseModel):
    """Payload para criação de nova categoria na Nuvemshop."""

    name: Dict[str, str] = Field(..., description="Nome multilíngue da categoria, ex: {'pt': 'Calçados'}")
    description: Optional[Dict[str, str]] = Field(default_factory=lambda: {"pt": ""}, description="Descrição multilíngue")
    parent: Optional[int] = Field(None, description="ID da categoria pai se for subcategoria")
    google_shopping_category: Optional[str] = Field(None, description="Categoria correspondente no Google Shopping")


class NuvemshopCategoryResponse(BaseModel):
    """DTO de resposta representando uma categoria na Nuvemshop."""

    id: int = Field(..., description="ID único da categoria na Nuvemshop")
    name: Dict[str, str] = Field(..., description="Nome multilíngue da categoria")
    description: Optional[Dict[str, str]] = Field(None, description="Descrição multilíngue")
    handle: Optional[Dict[str, str]] = Field(None, description="Slug/Handle multilíngue")
    parent: Optional[int] = Field(None, description="ID da categoria pai")
    subcategories: List[int] = Field(default_factory=list, description="IDs de subcategorias filhas")
    created_at: Optional[str] = Field(None, description="Data de criação ISO 8601")
    updated_at: Optional[str] = Field(None, description="Data da última atualização ISO 8601")

    model_config = {"from_attributes": True}
