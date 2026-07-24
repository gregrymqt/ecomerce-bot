import logging
from fastapi import APIRouter, Depends, Header, status

from app.core.security.auth import get_current_tenant_user
from app.features.scraper.services import AIScraperService
from app.features.scraper.schemas import AICredentialsRequest, WebScraperRequest

logger = logging.getLogger(__name__)
router = APIRouter(tags=["AI & Scraper"])

@router.post("/ai/credentials", status_code=status.HTTP_200_OK)
async def save_ai_credentials(
    payload: AICredentialsRequest,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: dict = Depends(get_current_tenant_user)
):
    """
    Registra ou atualiza as credenciais de IA (BYOK) para o Tenant atual.
    """
    raw_token = payload.access_token.get_secret_value()
    return await AIScraperService.save_credentials(
        tenant_id=x_tenant_id,
        provider=payload.provider,
        raw_token=raw_token
    )

@router.post("/scraper/extract", status_code=status.HTTP_202_ACCEPTED)
async def start_extraction(
    payload: WebScraperRequest,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: dict = Depends(get_current_tenant_user)
):
    """
    Dispara o processo assíncrono de Web Scraping publicando uma mensagem no RabbitMQ.
    """
    user_plan = current_user.get("plan", "free").lower()
    return await AIScraperService.enqueue_extraction_task(
        tenant_id=x_tenant_id,
        target_url=str(payload.url),
        plan=user_plan
    )
