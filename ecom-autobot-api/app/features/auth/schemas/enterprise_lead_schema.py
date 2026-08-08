from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class EnterpriseLeadRequest(BaseModel):
    """
    Schema de requisição contendo os dados do lead interessado no Plano Corporativo / SSO Enterprise.
    """
    email: EmailStr = Field(
        ...,
        description="E-mail corporativo do interessado",
        json_schema_extra={"example": "diretor.ti@suaempresa.com.br"}
    )
    company_name: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="Nome da empresa / organização",
        json_schema_extra={"example": "Empresa Exemplo S/A"}
    )
    team_size: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Tamanho estimado da equipe (ex: 1-10, 11-50, 50+)",
        json_schema_extra={"example": "11-50"}
    )
    phone: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Telefone/WhatsApp para contato comercial",
        json_schema_extra={"example": "+55 (11) 98765-4321"}
    )
    notes: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Observações ou necessidades específicas de integração",
        json_schema_extra={"example": "Precisamos de integração via Okta SAML 2.0"}
    )


class EnterpriseLeadResponse(BaseModel):
    """
    Schema de resposta contendo a confirmação do registro do lead corporativo.
    """
    id: str = Field(..., description="Identificador único da solicitação de lead")
    email: str = Field(..., description="E-mail cadastrado")
    company_name: str = Field(..., description="Nome da empresa")
    message: str = Field(
        default="Solicitação registrada com sucesso. Nosso time comercial entrará em contato em breve.",
        description="Mensagem de confirmação para o cliente"
    )
    created_at: Optional[datetime] = Field(None, description="Data e hora do registro")
