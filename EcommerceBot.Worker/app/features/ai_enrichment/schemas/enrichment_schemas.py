from typing import List, Optional
from pydantic import BaseModel, Field


class EnrichedProductResponse(BaseModel):
    title: str = Field(description="Título otimizado para conversão de vendas.")
    description: str = Field(description="A nova descrição persuasiva e magnética do produto em português do Brasil.")
    tags: List[str] = Field(description="Lista de tags estratégicas para SEO recomendadas para a loja.")


class LLMCompletionRequest(BaseModel):
    prompt: str = Field(..., description="Prompt principal para a LLM.")
    system_prompt: Optional[str] = Field(default=None, description="Instruções de sistema/contexto prévio.")
    temperature: float = Field(default=0.7, description="Criatividade da geração de texto.")
    max_tokens: int = Field(default=1000, description="Limite máximo de tokens gerados na resposta.")
    model_override: Optional[str] = Field(default=None, description="Modelo específico para sobrescrever o padrão.")


class LLMCompletionResponse(BaseModel):
    content: str = Field(..., description="Texto gerado retornado pela LLM.")
    model_used: str = Field(..., description="Identificador do modelo utilizado na resposta.")
    prompt_tokens: int = Field(default=0, description="Quantidade de tokens do prompt.")
    completion_tokens: int = Field(default=0, description="Quantidade de tokens gerados.")
    total_tokens: int = Field(default=0, description="Total de tokens consumidos na requisição.")
    provider_response_time_ms: float = Field(..., description="Tempo de resposta do provedor em milissegundos.")

