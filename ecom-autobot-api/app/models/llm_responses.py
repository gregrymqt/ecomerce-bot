from pydantic import BaseModel, Field
from typing import List

class EnrichedProductResponse(BaseModel):
    title: str = Field(description="Título otimizado para conversão de vendas.")
    description: str = Field(description="A nova descrição persuasiva e magnética do produto em português do Brasil.")
    tags: List[str] = Field(description="Lista de tags estratégicas para SEO recomendadas para a loja.")
