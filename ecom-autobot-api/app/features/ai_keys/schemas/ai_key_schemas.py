from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

from app.features.ai_keys.domain.enums import AIProvider


class AIKeyBase(BaseModel):
    provider: AIProvider = Field(..., description="Provedor de IA (ex: OPENAI, GEMINI, DEEPSEEK, GROQ, OPENROUTER)")
    preferred_models: Optional[List[str]] = Field(
        default=None, description="Lista opcional de modelos preferidos para o provedor"
    )
    is_active: bool = Field(default=True, description="Indica se a chave está ativa para uso")


class AIKeyCreate(AIKeyBase):
    api_key: str = Field(..., description="Chave de API do provedor")

    @field_validator("provider", mode="before")
    @classmethod
    def normalize_provider(cls, v: str) -> str:
        if isinstance(v, str):
            return v.upper()
        return v

    @model_validator(mode="after")
    def validate_openrouter_key(self) -> "AIKeyCreate":
        if self.provider == AIProvider.OPENROUTER:
            raw_key = self.api_key.strip()
            if not raw_key.startswith("sk-or-v1-"):
                raise ValueError("Chave de API do OpenRouter inválida. Deve iniciar com o prefixo 'sk-or-v1-'.")
        return self


class AIKeyUpdate(BaseModel):
    api_key: Optional[str] = Field(None, description="Nova chave de API do provedor (opcional)")
    preferred_models: Optional[List[str]] = Field(None, description="Nova lista de modelos preferidos (opcional)")
    is_active: Optional[bool] = Field(None, description="Novo status de ativação (opcional)")

    @model_validator(mode="after")
    def validate_openrouter_key_update(self) -> "AIKeyUpdate":
        if self.api_key is not None:
            raw_key = self.api_key.strip()
            if raw_key.startswith("sk-or-") and not raw_key.startswith("sk-or-v1-"):
                raise ValueError("Chave de API do OpenRouter inválida. Deve iniciar com o prefixo 'sk-or-v1-'.")
        return self


class AIKeyResponse(AIKeyBase):
    tenant_id: str = Field(..., description="ID do tenant associado")
    masked_key: Optional[str] = Field(None, description="Chave de API mascarada para segurança")
    created_at: Optional[datetime] = Field(None, description="Data de criação")
    updated_at: Optional[datetime] = Field(None, description="Data de última atualização")

    class Config:
        from_attributes = True
