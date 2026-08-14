from datetime import datetime, timezone
from typing import Literal, Optional
from pydantic import BaseModel, Field


class NuvemshopBulkSyncRequest(BaseModel):
    """
    DTO para requisição da rota de sincronização em lote de produtos para a Nuvemshop.
    """
    skus: list[str] = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Lista de SKUs para enfileirar e sincronizar na Nuvemshop."
    )
    force_update: bool = Field(
        False,
        description="Força o reenvio e atualização do produto mesmo se já sincronizado anteriormente."
    )
    visibility: Literal["visible", "unlisted", "hidden"] = Field(
        "visible",
        description="Visibilidade do produto na Nuvemshop ('visible', 'unlisted' ou 'hidden')."
    )


class NuvemshopBulkSyncResponse(BaseModel):
    """
    DTO de resposta HTTP 202 Accepted confirmando o enfileiramento das mensagens de sincronização.
    """
    job_id: str = Field(..., description="UUID v4 do lote de sincronização.")
    total_enqueued: int = Field(..., description="Quantidade total de mensagens publicadas na fila.")
    status: str = Field("queued", description="Status inicial do job.")
    message: str = Field(..., description="Mensagem complementar informando o sucesso do enfileiramento.")

    model_config = {"from_attributes": True}


class NuvemshopBulkSyncMessage(BaseModel):
    """
    Payload individual serializado e publicado na fila RabbitMQ 'nuvemshop_bulk_sync'.
    """
    job_id: str = Field(..., description="UUID v4 do lote.")
    tenant_id: str = Field(..., description="Identificador do tenant.")
    sku: str = Field(..., description="SKU do produto a ser sincronizado.")
    force_update: bool = Field(False, description="Flag informando se deve forçar atualização.")
    visibility: str = Field("visible", description="Visibilidade configurada ('visible', 'unlisted', 'hidden').")
    attempt: int = Field(1, description="Número da tentativa de envio (para retentativas).")
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="Timestamp de criação da mensagem no formato ISO."
    )
