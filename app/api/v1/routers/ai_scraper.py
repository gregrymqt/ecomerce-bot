
import logging
from fastapi import APIRouter, Depends, Header, status


# Infraestrutura e Segurança Existentes do seu Ecossistema
from app.dependencies.auth import get_current_tenant_user
from app.services.ai_scraper_service import AIScraperService
from app.models.ai_scraper_model import AICredentialsRequest, WebScraperRequest

logger = logging.getLogger(__name__)
router = APIRouter(tags=["AI & Scraper"])

# -------------------------------------------------------------------------
# Endpoints da API
# -------------------------------------------------------------------------

@router.post("/ai/credentials", status_code=status.HTTP_200_OK)
async def save_ai_credentials(
    payload: AICredentialsRequest,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: dict = Depends(get_current_tenant_user)
):
    """
    Registra ou atualiza as credenciais de IA (BYOK) para o Tenant atual.
    O JWT é validado e o isolamento do tenant_id é garantido pelo Dependes.
    """
    # Extrai o valor limpo do token protegido
    raw_token = payload.access_token.get_secret_value()
    
    # Delega a lógica de criptografia e persistência para o Service
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
    O ScraperWorker irá consumir esta mensagem em background.
    """
    # Extrai o plano do usuário, assumindo fallback seguro caso não exista no dict
    user_plan = current_user.get("plan", "free").lower()
    
    # Delega a lógica de enfileiramento e mensageria para o Service
    return await AIScraperService.enqueue_extraction_task(
        tenant_id=x_tenant_id,
        target_url=str(payload.url),
        plan=user_plan
    )