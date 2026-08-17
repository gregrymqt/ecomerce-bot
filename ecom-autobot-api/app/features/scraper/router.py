from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.core.security.auth import get_current_tenant_user
from app.core.shared.logger import get_logger
from app.features.auth.schemas import AuthenticatedUser
from app.features.scraper.domain import ScraperDomainException
from app.features.scraper.schemas import WebScraperRequest
from app.features.scraper.services import ai_scraper_service
from app.features.wallet.dependencies import require_wallet_balance

logger = get_logger("ScraperRouter")
router = APIRouter(tags=["AI & Scraper"])


@router.post(
    "/scraper/extract",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_wallet_balance(min_credits=1))],
)
async def start_extraction(
    payload: WebScraperRequest,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
):
    """
    Dispara o processo assíncrono de Web Scraping publicando uma mensagem no RabbitMQ.
    Garantido pelo Gatekeeper require_wallet_balance(min_credits=1).
    """
    user_plan = (current_user.plan or "free").lower()
    try:
        return await ai_scraper_service.enqueue_extraction_task(
            tenant_id=x_tenant_id,
            target_url=str(payload.url),
            plan=user_plan,
        )
    except ScraperDomainException as err:
        logger.warning(f"⚠️ [ScraperRouter] Exceção de domínio no enfileiramento: {err}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )
