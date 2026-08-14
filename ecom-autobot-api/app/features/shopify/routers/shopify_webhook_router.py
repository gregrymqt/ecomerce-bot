from typing import Optional
from fastapi import APIRouter, Depends, Header, Request, status
from fastapi.responses import JSONResponse

from app.features.shopify.services import ShopifyWebhookService

router = APIRouter(prefix="/shopify", tags=["Shopify Webhooks"])


def get_shopify_webhook_service() -> ShopifyWebhookService:
    return ShopifyWebhookService()


@router.post(
    "/webhooks",
    status_code=status.HTTP_200_OK,
    summary="Receptor de Webhooks da Shopify com Validação HMAC-SHA256",
)
async def shopify_webhook(
    request: Request,
    x_shopify_hmac: Optional[str] = Header(None, alias="X-Shopify-Hmac-Sha256"),
    x_shopify_webhook_id: Optional[str] = Header(None, alias="X-Shopify-Webhook-Id"),
    x_shopify_shop_domain: Optional[str] = Header(None, alias="X-Shopify-Shop-Domain"),
    x_shopify_topic: Optional[str] = Header(None, alias="X-Shopify-Topic"),
    webhook_service: ShopifyWebhookService = Depends(get_shopify_webhook_service),
) -> JSONResponse:
    raw_body = await request.body()
    result = await webhook_service.process_incoming_webhook(
        raw_body=raw_body,
        hmac_header=x_shopify_hmac,
        webhook_id=x_shopify_webhook_id,
        shop_domain=x_shopify_shop_domain,
        topic=x_shopify_topic,
    )
    return JSONResponse(status_code=status.HTTP_200_OK, content=result)
