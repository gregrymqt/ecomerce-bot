import logging
from fastapi import APIRouter, HTTPException, Depends, Header, status

from app.core.security.auth import get_current_tenant_user
from app.features.auth.schemas.auth_schemas import AuthenticatedUser
from app.features.settings.schemas.settings_schemas import (
    TenantSettingsResponse,
    TenantSettingsUpdate,
)
from app.features.settings.services.settings_service import SettingsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["Settings"])


def get_settings_service() -> SettingsService:
    return SettingsService()


@router.get("", response_model=TenantSettingsResponse)
@router.get("/", response_model=TenantSettingsResponse)
async def get_tenant_settings(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
    service: SettingsService = Depends(get_settings_service),
):
    """
    Retorna as configurações operacionais ativas do tenant (Diretrizes de IA, Precificação e Perfil).
    Aplica fallback automático para padrões do sistema caso o registro ainda não exista.
    """
    try:
        return await service.get_settings(tenant_id=x_tenant_id)
    except Exception as e:
        logger.error(f"Erro ao buscar configurações para tenant '{x_tenant_id}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao consultar configurações do tenant.",
        )


@router.put("", response_model=TenantSettingsResponse)
@router.put("/", response_model=TenantSettingsResponse)
async def update_tenant_settings(
    payload: TenantSettingsUpdate,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
    service: SettingsService = Depends(get_settings_service),
):
    """
    Atualiza ou cria as preferências operacionais do lojista (upsert)
    e invalida imediatamente o cache Redis do tenant.
    """
    try:
        return await service.update_settings(tenant_id=x_tenant_id, data=payload)
    except Exception as e:
        logger.error(f"Erro ao atualizar configurações do tenant '{x_tenant_id}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao salvar configurações do tenant.",
        )
