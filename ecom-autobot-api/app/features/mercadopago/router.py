from typing import Any, Dict, Optional
from fastapi import APIRouter, Header, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse

from app.core.shared.logger import get_logger
from app.features.mercadopago.domain import MercadoPagoSignatureError
from app.features.mercadopago.services import mercadopago_webhook_service

logger = get_logger("MercadoPagoRouter")
router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post(
    "/mercadopago",
    status_code=status.HTTP_200_OK,
    summary="Receptor de Webhooks do Mercado Pago (Desacoplado DDD)",
)
async def mercadopago_webhook(
    request: Request,
    data_id: Optional[str] = Query(None, alias="data.id"),
    id_param: Optional[str] = Query(None, alias="id"),
    x_signature: Optional[str] = Header(None, alias="x-signature"),
    x_request_id: Optional[str] = Header(None, alias="x-request-id"),
) -> Dict[str, str]:
    """
    Endpoint para ingestão assíncrona de eventos de Webhook do Mercado Pago.
    Valida a assinatura HMAC-SHA256, assegura idempotência no Redis 24h e enfileira no RabbitMQ.
    """
    try:
        try:
            raw_body: Dict[str, Any] = await request.json()
        except Exception:
            raw_body = {}

        resource_id_param = data_id or id_param
        result = await mercadopago_webhook_service.process_webhook(
            raw_body=raw_body,
            resource_id_param=resource_id_param,
            x_signature=x_signature,
            x_request_id=x_request_id,
        )
        return result

    except MercadoPagoSignatureError as sig_err:
        logger.warning(f"🚫 [MercadoPagoRouter] Assinatura de webhook inválida: {sig_err}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Assinatura de Webhook inválida ou não configurada.",
        )
    except Exception as err:
        logger.error(f"💥 [MercadoPagoRouter] Erro interno ao processar webhook do Mercado Pago: {err}", exc_info=True)
        return JSONResponse(
            content={"status": "error", "message": "Erro processado defensivamente"},
            status_code=status.HTTP_200_OK,
        )