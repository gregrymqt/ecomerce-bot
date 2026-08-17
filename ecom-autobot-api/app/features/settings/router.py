from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.core.security.auth import get_current_tenant_user
from app.core.shared.logger import get_logger
from app.features.auth.schemas import AuthenticatedUser
from app.features.settings.domain import SettingsDomainException
from app.features.settings.schemas import (
    TenantSettingsResponse,
    TenantSettingsUpdate,
)
from app.features.settings.services import settings_service

logger = get_logger("SettingsRouter")
router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=TenantSettingsResponse)
@router.get("/", response_model=TenantSettingsResponse)
async def get_tenant_settings(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
):
    """
    Retorna as configurações operacionais ativas do tenant (Diretrizes de IA, Precificação e Perfil).
    Aplica fallback automático para padrões do sistema caso o registro ainda não exista.
    """
    try:
        return await settings_service.get_settings(tenant_id=x_tenant_id)
    except SettingsDomainException as err:
        logger.warning(f"Exceção de domínio ao buscar configurações do tenant '{x_tenant_id}': {err}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )
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
):
    """
    Atualiza ou cria as preferências operacionais do lojista (upsert)
    e invalida imediatamente o cache Redis do tenant.
    """
    try:
        return await settings_service.update_settings(tenant_id=x_tenant_id, data=payload)
    except SettingsDomainException as err:
        logger.warning(f"Exceção de domínio ao atualizar configurações do tenant '{x_tenant_id}': {err}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )
    except Exception as e:
        logger.error(f"Erro ao atualizar configurações do tenant '{x_tenant_id}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao salvar configurações do tenant.",
        )
