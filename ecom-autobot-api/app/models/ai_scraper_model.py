# DTOs / Schemas Pydantic
# -------------------------------------------------------------------------

from pydantic import Field, SecretStr, HttpUrl,BaseModel

class AICredentialsRequest(BaseModel):
    tenant_id: str = Field(..., description="ID do tenant (isolamento)")
    provider: str = Field(..., description="Nome do provedor de IA (ex: openai, gemini)")
    access_token: SecretStr = Field(..., description="Chave de API token do provedor")

class WebScraperRequest(BaseModel):
    tenant_id: str = Field(..., description="ID do tenant (isolamento)")
    url: HttpUrl = Field(..., description="URL da página do catálogo ou produto para extração")