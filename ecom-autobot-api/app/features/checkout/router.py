from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import get_db
from app.core.security.auth import get_current_tenant_user
from app.features.auth.schemas import AuthenticatedUser
from app.features.checkout.repositories.order_repository import OrderRepository
from app.features.checkout.schemas.service_schemas import (
    CheckoutResultOutput,
    CreateCreditCardCheckoutInput,
    CreatePixCheckoutInput,
)
from app.features.checkout.services.checkout_service import CheckoutService

router = APIRouter(prefix="/checkout", tags=["Checkout & Payments"])


# ==========================================
# 1. CHECKOUT PIX
# ==========================================

@router.post(
    "/pix",
    response_model=CheckoutResultOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Criar pagamento PIX",
    description="Gera a preferência de pagamento instantâneo PIX com QR Code e Copia e Cola.",
)
async def create_pix_checkout(
    payload: CreatePixCheckoutInput,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
):
    service = CheckoutService(db)
    try:
        return await service.create_pix_payment(tenant_id=x_tenant_id, input_data=payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Falha ao gerar cobrança PIX: {str(exc)}",
        )


# ==========================================
# 2. CHECKOUT CARTÃO DE CRÉDITO
# ==========================================

@router.post(
    "/credit-card",
    response_model=CheckoutResultOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Processar pagamento via Cartão de Crédito",
    description="Processa cobrança transparente direta no cartão de crédito via token gerado no frontend.",
)
async def create_credit_card_checkout(
    payload: CreateCreditCardCheckoutInput,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_tenant_user),
):
    service = CheckoutService(db)
    try:
        return await service.create_credit_card_payment(tenant_id=x_tenant_id, input_data=payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Falha ao processar pagamento com cartão: {str(exc)}",
        )


# ==========================================
# 3. CONSULTA DE STATUS DO PEDIDO (COM CACHE)
# ==========================================

@router.get(
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
    repo = OrderRepository(db)
    order = await repo.get_by_id(tenant_id=x_tenant_id, order_id=order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido não encontrado.",
        )
    return order.to_dict()


# ==========================================
# 4. SINCRONIZAR STATUS COM MERCADO PAGO
# ==========================================

@router.post(
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
    service = CheckoutService(db)
    synced_order = await service.sync_order_status_from_mp(tenant_id=x_tenant_id, mp_order_id=mp_order_id)
    if not synced_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido do Mercado Pago não encontrado no sistema.",
        )
    return synced_order.to_dict()


# ==========================================
# 5. CANCELAMENTO E REEMBOLSO
# ==========================================

@router.post(
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
    service = CheckoutService(db)
    success = await service.cancel_order(tenant_id=x_tenant_id, order_id=order_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível cancelar o pedido. Verifique o ID e o status atual.",
        )
    return {"message": "Pedido cancelado com sucesso."}


@router.post(
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
    service = CheckoutService(db)
    success = await service.refund_order(tenant_id=x_tenant_id, order_id=order_id, amount=amount)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível processar o reembolso do pedido.",
        )
    return {"message": "Solicitação de reembolso enviada com sucesso."}