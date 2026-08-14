from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import get_db
from app.core.security.auth import get_current_tenant_user
from app.features.auth.schemas import AuthenticatedUser
from app.features.checkout.domain.exceptions import (
    InvalidOrderStateError,
    OrderCancellationError,
    OrderNotFoundError,
    OrderRefundError,
)
from app.features.checkout.services.refund_service import RefundService

refund_router = APIRouter(prefix="/checkout", tags=["Checkout - Refunds & Cancellations"])


# ==========================================
# 1. CANCELAMENTO DE PEDIDO PENDENTE
# ==========================================

@refund_router.post(
    "/orders/{order_id}/cancel",
    summary="Cancelar pedido pendente",
    description="Cancela pedidos pendentes de pagamento localmente e no Mercado Pago.",
)
async def cancel_checkout_order(
    order_id: str,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
):
    service = RefundService(db)
    try:
        await service.cancel_order(tenant_id=x_tenant_id, order_id=order_id)
        return {"message": "Pedido cancelado com sucesso."}
    except OrderNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=exc.message,
        )
    except (OrderCancellationError, InvalidOrderStateError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.message,
        )


# ==========================================
# 2. REEMBOLSO / ESTORNO DE PEDIDO
# ==========================================

@refund_router.post(
    "/orders/{order_id}/refund",
    summary="Reembolsar/Estornar pedido",
    description="Executa o reembolso total ou parcial de um pedido aprovado.",
)
async def refund_checkout_order(
    order_id: str,
    amount: Optional[Decimal] = None,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
):
    service = RefundService(db)
    try:
        await service.refund_order(tenant_id=x_tenant_id, order_id=order_id, amount=amount)
        return {"message": "Solicitação de reembolso enviada com sucesso."}
    except OrderNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=exc.message,
        )
    except (OrderRefundError, InvalidOrderStateError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.message,
        )
