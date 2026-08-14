from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class NuvemshopOAuthAuthorizeResponse(BaseModel):
    """Resposta com a URL de consentimento OAuth da Nuvemshop e o token anti-CSRF state."""

    authorize_url: str = Field(..., description="URL pública de consentimento da Nuvemshop")
    state: str = Field(..., description="Token anti-CSRF temporário gerado no Redis")


class NuvemshopOAuthTokenResponse(BaseModel):
    """DTO de resposta da troca do código de autorização por tokens na API da Nuvemshop."""

    access_token: str = Field(..., description="Token de acesso OAuth obtido")
    token_type: str = Field("bearer", description="Tipo de token (bearer)")
    scope: str = Field(..., description="Lista de escopos concedidos")
    user_id: int = Field(..., description="ID do usuário lojista na Nuvemshop")
    store_id: int = Field(..., description="ID da loja na Nuvemshop")


class NuvemshopWebhookRegistrationPayload(BaseModel):
    """Payload para subscrição/cadastro de webhook na API REST da Nuvemshop."""

    event: str = Field(..., description="Tópico do webhook (ex: product/created, app/uninstalled)")
    url: str = Field(..., description="URL pública de recebimento dos eventos no backend")


class NuvemshopWebhookRegistrationResponse(BaseModel):
    """DTO de resposta de um webhook cadastrado na Nuvemshop."""

    id: int = Field(..., description="ID único do webhook na Nuvemshop")
    event: str = Field(..., description="Tópico do evento subscrito")
    url: str = Field(..., description="URL cadastrada para recebimento")
    created_at: Optional[str] = Field(None, description="Data de criação")
    updated_at: Optional[str] = Field(None, description="Data da última atualização")

    model_config = {"from_attributes": True}
