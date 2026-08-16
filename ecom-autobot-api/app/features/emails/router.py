from fastapi import APIRouter, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse

from app.core.shared.logger import get_logger
from app.features.emails.domain.exceptions import InvalidWebhookSignatureError
from app.features.emails.services.webhook_service import email_webhook_service

logger = get_logger("EmailsRouter")

router = APIRouter(prefix="/emails", tags=["Emails"])


@router.post("/webhooks", status_code=status.HTTP_200_OK)
async def handle_resend_webhook(
    request: Request,
    svix_id: str = Header(None, alias="svix-id"),
    svix_timestamp: str = Header(None, alias="svix-timestamp"),
    svix_signature: str = Header(None, alias="svix-signature"),
):
    """
    Endpoint para ingestão de eventos e ciclo de vida de e-mails via Webhooks do Resend.
    Valida a assinatura Svix, assegura idempotência no Redis e atualiza o estado em 'email_logs'.
    """
    try:
        raw_body = await request.body()
        await email_webhook_service.process_webhook(
            raw_body=raw_body,
            svix_id=svix_id,
            svix_timestamp=svix_timestamp,
            svix_signature=svix_signature,
        )
        return JSONResponse(content={"status": "success", "message": "Webhook processado"})

    except InvalidWebhookSignatureError as sig_err:
        logger.warning(f"🚫 [Router] Assinatura de webhook inválida: {sig_err}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Assinatura de webhook inválida",
        )
    except Exception as err:
        logger.error(f"💥 [Router] Erro interno ao processar webhook do Resend: {err}", exc_info=True)
        # Responde 200 para o Resend não reter a fila indefinidamente caso ocorra erro interno não fatal
        return JSONResponse(
            content={"status": "error", "message": "Erro processado defensivamente"},
            status_code=status.HTTP_200_OK,
        )