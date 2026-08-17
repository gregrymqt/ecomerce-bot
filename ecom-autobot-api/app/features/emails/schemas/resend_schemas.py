from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ResendTag(BaseModel):
    """Tag personalizada aceita pela API do Resend (máx. 256 caracteres)."""
    name: str = Field(..., max_length=256, description="Nome da tag (a-z, A-Z, 0-9, _, -)")
    value: str = Field(..., max_length=256, description="Valor da tag")

    model_config = ConfigDict(extra="forbid")


class ResendAttachment(BaseModel):
    """Anexo em Base64 ou URL hospedada aceito pelo Resend (máx. 40MB)."""
    filename: str = Field(..., description="Nome do arquivo com extensão")
    content: Optional[str] = Field(None, description="Conteúdo do arquivo codificado em Base64")
    path: Optional[str] = Field(None, description="URL pública ou caminho onde o arquivo está hospedado")
    content_type: Optional[str] = Field(None, description="MIME type (ex: application/pdf)")
    content_id: Optional[str] = Field(None, description="ID para embutir imagem inline (cid:...)")

    model_config = ConfigDict(extra="forbid")


class ResendSendEmailRequest(BaseModel):
    """
    Payload DTO estrito para o endpoint POST https://api.resend.com/emails.
    Segue fielmente os parâmetros suportados pela API pública do Resend.
    """
    from_email: str = Field(
        ...,
        alias="from",
        description="Remetente no formato 'Nome <email@dominio.com>' ou 'email@dominio.com'"
    )
    to: Union[EmailStr, List[EmailStr]] = Field(
        ...,
        description="Destinatário único ou lista de até 50 destinatários"
    )
    subject: str = Field(..., description="Assunto do e-mail")
    html: Optional[str] = Field(None, description="Corpo do e-mail formatado em HTML")
    text: Optional[str] = Field(None, description="Versão em texto puro do e-mail")
    bcc: Optional[Union[EmailStr, List[EmailStr]]] = None
    cc: Optional[Union[EmailStr, List[EmailStr]]] = None
    reply_to: Optional[Union[EmailStr, List[EmailStr]]] = None
    scheduled_at: Optional[str] = Field(
        None,
        description="Agendamento em ISO 8601 ou linguagem natural aceita pelo Resend"
    )
    headers: Optional[Dict[str, str]] = Field(
        default_factory=dict,
        description="Headers HTTP customizados"
    )
    tags: Optional[List[ResendTag]] = Field(
        default_factory=list,
        description="Tags de rastreamento e correlação"
    )
    attachments: Optional[List[ResendAttachment]] = Field(
        default_factory=list,
        description="Lista de arquivos anexados"
    )
    template: Optional[Dict[str, Any]] = Field(
        None,
        description="Objeto contendo 'id' e 'variables' para disparos via templates nativos do Resend"
    )

    @field_validator("to", "bcc", "cc", "reply_to", mode="after")
    @classmethod
    def normalize_email_lists(cls, v: Any) -> Any:
        if isinstance(v, str):
            return [v]
        return v

    model_config = ConfigDict(
        populate_by_name=True,
        extra="ignore"
    )


class ResendSendEmailResponse(BaseModel):
    """Resposta padrão retornada pelo Resend ao disparar um e-mail."""
    id: str = Field(..., description="Identificador único da mensagem no Resend (UUID)")

    model_config = ConfigDict(extra="ignore")


class ResendBatchResponse(BaseModel):
    """Resposta retornada pelo endpoint POST https://api.resend.com/emails/batch."""
    data: List[ResendSendEmailResponse] = Field(
        default_factory=list,
        description="Lista de IDs gerados para cada mensagem do lote"
    )

    model_config = ConfigDict(extra="ignore")