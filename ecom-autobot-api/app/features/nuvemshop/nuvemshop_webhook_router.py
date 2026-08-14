from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from typing import Optional

from app.core.security.auth import get_current_tenant_user, sanitize_tenant_id
from app.features.auth.schemas import AuthenticatedUser
from app.features.nuvemshop.services import NuvemshopOAuthService, NuvemshopWebhookService

nuvemshop_webhook_router = APIRouter(prefix="/nuvemshop", tags=["Nuvemshop Webhooks"])


def get_nuvemshop_webhook_service() -> NuvemshopWebhookService:
    return NuvemshopWebhookService()


def get_nuvemshop_oauth_service() -> NuvemshopOAuthService:
    return NuvemshopOAuthService()


@nuvemshop_webhook_router.post("/webhooks", status_code=status.HTTP_200_OK)
async def nuvemshop_webhook(
    request: Request,
    x_linkedstore_hmac_sha256: Optional[str] = Header(None, alias="X-Linkedstore-Hmac-Sha256"),
    service: NuvemshopWebhookService = Depends(get_nuvemshop_webhook_service),
):
    """
    Endpoint público de recepção de Webhooks da Nuvemshop.
    Valida a assinatura HMAC, aplica idempotência no Redis e publica no RabbitMQ em < 2s.
    """
    raw_body = await request.body()
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    return await service.enqueue_webhook_event(
        payload=payload,
        raw_body=raw_body,
        hmac_header=x_linkedstore_hmac_sha256,
    )


@nuvemshop_webhook_router.post("/webhooks/auto-register")
async def auto_register_webhooks(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    user: AuthenticatedUser = Depends(get_current_tenant_user),
    service: NuvemshopOAuthService = Depends(get_nuvemshop_oauth_service),
):
    """
    Força o auto-registro resiliente de webhooks para a loja vinculada ao tenant ativo.
    """
    clean_tenant = sanitize_tenant_id(x_tenant_id)
    creds = await service.nuvemshop_repo.get_credentials(clean_tenant)
    if not creds or not creds.access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tenant '{clean_tenant}' não possui credenciais válidas da Nuvemshop configuradas.",
        )
    webhooks = await service.auto_register_webhooks(
        tenant_id=clean_tenant,
        store_id=int(creds.store_id),
        access_token=creds.access_token,
    )
    return {
        "status": "success",
        "tenant_id": clean_tenant,
        "store_id": creds.store_id,
        "registered_webhooks": webhooks,
    }
