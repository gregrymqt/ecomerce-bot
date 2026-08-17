from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse

from app.core.security.auth import get_current_tenant_user, sanitize_tenant_id
from app.core.shared.logger import get_logger
from app.features.auth.schemas import AuthenticatedUser
from app.features.nuvemshop.domain import NuvemshopSignatureError, NuvemshopWebhookProcessingError
from app.features.nuvemshop.services import NuvemshopOAuthService, NuvemshopWebhookService

logger = get_logger("NuvemshopWebhookRouter")
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
    Valida a assinatura HMAC, grava auditoria no DB, aplica idempotência no Redis e publica no RabbitMQ.
    """
    raw_body = await request.body()
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    try:
        return await service.enqueue_webhook_event(
            payload=payload,
            raw_body=raw_body,
            hmac_header=x_linkedstore_hmac_sha256,
        )
    except NuvemshopSignatureError as sig_err:
        logger.warning(f"🚫 [NuvemshopWebhookRouter] Assinatura HMAC inválida: {sig_err}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Assinatura HMAC inválida para o webhook da Nuvemshop.",
        )
    except NuvemshopWebhookProcessingError as proc_err:
        logger.error(f"💥 [NuvemshopWebhookRouter] Erro de processamento: {proc_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(proc_err),
        )
    except Exception as err:
        logger.error(f"💥 [NuvemshopWebhookRouter] Erro não esperado no webhook: {err}", exc_info=True)
        return JSONResponse(
            content={"status": "error", "message": "Erro processado defensivamente"},
            status_code=status.HTTP_200_OK,
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
