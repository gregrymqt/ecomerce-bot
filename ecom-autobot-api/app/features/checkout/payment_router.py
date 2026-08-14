from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import get_db
from app.core.security.auth import get_current_tenant_user
from app.core.security.rate_limiter import rate_limit_dependency
from app.features.auth.schemas import AuthenticatedUser
from app.features.checkout.domain.exceptions import PaymentProcessingError
from app.features.checkout.schemas.service_schemas import (
    CheckoutResultOutput,
    CreateCreditCardCheckoutInput,
    CreatePixCheckoutInput,
)
from app.features.checkout.services.payment_service import PaymentService

payment_router = APIRouter(prefix="/checkout", tags=["Checkout - Payments"])


# ==========================================
# 1. CHECKOUT PIX
# ==========================================

@payment_router.post(
    "/pix",
    response_model=CheckoutResultOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Criar pagamento PIX",
    description="Gera a preferência de pagamento instantâneo PIX com QR Code e Copia e Cola.",
    dependencies=[Depends(rate_limit_dependency(times=10, seconds=60))],
)
async def create_pix_checkout(
    payload: CreatePixCheckoutInput,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
):
    service = PaymentService(db)
    try:
        return await service.create_pix_payment(tenant_id=x_tenant_id, input_data=payload)
    except PaymentProcessingError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.message,
        )


# ==========================================
# 2. CHECKOUT CARTÃO DE CRÉDITO
# ==========================================

@payment_router.post(
    "/credit-card",
    response_model=CheckoutResultOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Processar pagamento via Cartão de Crédito",
    description="Processa cobrança transparente direta no cartão de crédito via token gerado no frontend.",
    dependencies=[Depends(rate_limit_dependency(times=10, seconds=60))],
)
async def create_credit_card_checkout(
    payload: CreateCreditCardCheckoutInput,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
):
    service = PaymentService(db)
    try:
        return await service.create_credit_card_payment(tenant_id=x_tenant_id, input_data=payload)
    except PaymentProcessingError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.message,
        )
