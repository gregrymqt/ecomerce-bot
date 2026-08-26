from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class LLMCompletionRequest(BaseModel):
    prompt: str
    system_prompt: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 1500
    model_override: Optional[str] = None

class LLMCompletionResponse(BaseModel):
    content: str
    model_used: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    provider_response_time_ms: float = 0.0

class EnrichedProductResponse(BaseModel):
    title: str = Field(..., description="Título persuasivo e otimizado para SEO.")
    description: str = Field(..., description="Descrição comercial e envolvente.")
    seo_keywords: List[str] = Field(default_factory=list)
