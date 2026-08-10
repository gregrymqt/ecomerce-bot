import logging
from fastapi import APIRouter, Depends, Header, status

from app.core.security.auth import get_current_tenant_user
from app.features.auth.schemas import AuthenticatedUser
from app.features.scraper.services import AIScraperService
from app.features.scraper.schemas import WebScraperRequest
from app.features.wallet.dependencies import require_wallet_balance

logger = logging.getLogger(__name__)
router = APIRouter(tags=["AI & Scraper"])

@router.post(
    "/scraper/extract",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_wallet_balance(min_credits=1))],
)
async def start_extraction(
    payload: WebScraperRequest,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user)
):
    """
    Dispara o processo assíncrono de Web Scraping publicando uma mensagem no RabbitMQ.
    Garantido pelo Gatekeeper require_wallet_balance(min_credits=1).
    """
    user_plan = (current_user.plan or "free").lower()
    return await AIScraperService.enqueue_extraction_task(
        tenant_id=x_tenant_id,
        target_url=str(payload.url),
        plan=user_plan
    )

