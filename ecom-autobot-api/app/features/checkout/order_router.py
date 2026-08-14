from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import get_db
from app.core.security.auth import get_current_tenant_user
from app.features.auth.schemas import AuthenticatedUser
from app.features.checkout.domain.exceptions import OrderNotFoundError
from app.features.checkout.services.order_service import OrderService

order_router = APIRouter(prefix="/checkout", tags=["Checkout - Orders"])


# ==========================================
# 1. CONSULTA DE STATUS DO PEDIDO
# ==========================================

@order_router.get(
    "/orders/{order_id}",
    summary="Buscar pedido por ID",
    description="Recupera o estado atual do pedido do banco relacional ou cache Redis.",
)
async def get_checkout_order(
    order_id: str,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
):
    service = OrderService(db)
    order = await service.get_order_by_id(tenant_id=x_tenant_id, order_id=order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido não encontrado.",
        )
    return order.to_dict()


# ==========================================
# 2. SINCRONIZAR STATUS COM MERCADO PAGO
# ==========================================

@order_router.post(
    "/orders/{mp_order_id}/sync",
    summary="Forçar sincronização de status",
    description="Consulta o Mercado Pago diretamente e atualiza o estado local e cache.",
)
async def sync_checkout_order(
    mp_order_id: str,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
):
    service = OrderService(db)
    try:
        synced_order = await service.sync_order_status_from_mp(tenant_id=x_tenant_id, mp_order_id=mp_order_id)
        return synced_order.to_dict()
    except OrderNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=exc.message,
        )
