from typing import List, Optional
from pydantic import BaseModel, Field


class GoogleLoginUrlResponse(BaseModel):
    """
    Schema de resposta contendo a URL gerada para redirecionamento do consentimento Google.
    """
    url: str = Field(
        ...,
        description="URL gerada para redirecionamento do consentimento Google",
        json_schema_extra={"example": "https://accounts.google.com/o/oauth2/v2/auth?client_id=..."}
    )


class GoogleCallbackRequest(BaseModel):
    """
    Schema de requisição contendo o código de autorização e parâmetros opcionais do callback do Google.
    """
    code: str = Field(
        ...,
        description="Código de autorização retornado pelo Google OAuth",
        json_schema_extra={"example": "4/0AY0e-gC..."}
    )
    state: Optional[str] = Field(
        default=None,
        description="Estado OAuth opcional para prevenção de CSRF ou contexto de sessão",
        json_schema_extra={"example": "xyz123state"}
    )
    tenant_name: Optional[str] = Field(
        default=None,
        description="Nome da organização/tenant para cadastro de novos usuários/organizações",
        json_schema_extra={"example": "Minha Empresa LTDA"}
    )


class GoogleUserPayload(BaseModel):
    """
    Estrutura interna para mapear os dados do perfil de usuário retornados pelo Google.
    """
    email: str = Field(
        ...,
        description="E-mail principal do usuário retornado pelo Google",
        json_schema_extra={"example": "usuario@gmail.com"}
    )
    sub: str = Field(
        ...,
        description="Identificador único (Subject ID) do usuário no Google",
        json_schema_extra={"example": "109876543210987654321"}
    )
    name: Optional[str] = Field(
        default=None,
        description="Nome completo do usuário retornado pelo Google",
        json_schema_extra={"example": "João Silva"}
    )
    picture: Optional[str] = Field(
        default=None,
        description="URL da foto de perfil do usuário",
        json_schema_extra={"example": "https://lh3.googleusercontent.com/a/..."}
    )
    email_verified: bool = Field(
        default=False,
        description="Indica se o e-mail foi verificado pelo Google",
        json_schema_extra={"example": True}
    )


class AuthTokenResponse(BaseModel):
    """
    Estrutura padrão de retorno do JWT da aplicação com a lista de tenants vinculados.
    """
    access_token: str = Field(
        ...,
        description="Token de acesso JWT emitido pela aplicação",
        json_schema_extra={"example": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
    )
    token_type: str = Field(
        default="bearer",
        description="Tipo do token (ex: bearer)",
        json_schema_extra={"example": "bearer"}
    )
    user_id: str = Field(
        ...,
        description="Identificador único do usuário na aplicação",
        json_schema_extra={"example": "usr_123456"}
    )
    email: str = Field(
        ...,
        description="E-mail do usuário autenticado",
        json_schema_extra={"example": "usuario@ecommerce.com"}
    )
    name: str = Field(
        ...,
        description="Nome do usuário autenticado",
        json_schema_extra={"example": "João Silva"}
    )
    tenants: List[str] = Field(
        default_factory=list,
        description="Lista de tenants aos quais o usuário possui acesso",
        json_schema_extra={"example": ["ecommerce_demo", "ecommerce_prod"]}
    )
    tenant_id: Optional[str] = Field(
        default=None,
        description="Tenant ativo vinculado ou selecionado na sessão",
        json_schema_extra={"example": "ecommerce_demo"}
    )
