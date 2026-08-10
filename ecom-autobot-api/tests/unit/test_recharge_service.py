from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.checkout.domain.enums import OrderStatus
from app.features.checkout.schemas.service_schemas import CheckoutResultOutput
from app.features.checkout.services.checkout_service import CheckoutService
from app.features.wallet.schemas import RechargeRequest, RechargeResponse
from app.features.wallet.services.credit_service import CreditService
from app.features.wallet.services.recharge_service import RechargeService


@pytest.mark.asyncio
async def test_create_recharge_payment_pix_success() -> None:
    session = AsyncMock(spec=AsyncSession)
    checkout_mock = AsyncMock(spec=CheckoutService)
    credit_mock = AsyncMock(spec=CreditService)

    checkout_mock.create_pix_payment.return_value = CheckoutResultOutput(
        order_id="ord_123",
        mp_order_id="mp_pix_999",
        external_reference='{"tenant_id":"tenant_qa","credits":100}',
        status=OrderStatus.CREATED,
        total_amount=20.0,
        pix_qr_code="0002010120042...",
        pix_qr_code_base64="iVBORw0KGgo...",
    )

    service = RechargeService(
        session=session,
        checkout_service=checkout_mock,
        credit_service=credit_mock,
    )
    req = RechargeRequest(
        credits_package=100,
        payment_method="pix",
        payer_email="customer@test.com",
    )

    res = await service.create_recharge_payment(tenant_id="tenant_qa", payload=req)

    assert isinstance(res, RechargeResponse)
    assert res.payment_id == "mp_pix_999"
    assert res.status == "created"
    assert res.pix_copia_e_cola == "0002010120042..."
    assert res.pix_qr_code == "iVBORw0KGgo..."

    checkout_mock.create_pix_payment.assert_awaited_once()
    pix_input = checkout_mock.create_pix_payment.call_args.kwargs["input_data"]
    assert pix_input.total_amount == 20.0
    assert pix_input.customer.email == "customer@test.com"
    assert pix_input.items[0].external_code == "pkg_100"


@pytest.mark.asyncio
async def test_create_recharge_payment_credit_card_success() -> None:
    session = AsyncMock(spec=AsyncSession)
    checkout_mock = AsyncMock(spec=CheckoutService)
    credit_mock = AsyncMock(spec=CreditService)

    checkout_mock.create_credit_card_payment.return_value = CheckoutResultOutput(
        order_id="ord_456",
        mp_order_id="mp_card_888",
        external_reference='{"tenant_id":"tenant_qa","credits":500}',
        status=OrderStatus.PROCESSED,
        total_amount=80.0,
    )

    service = RechargeService(
        session=session,
        checkout_service=checkout_mock,
        credit_service=credit_mock,
    )
    req = RechargeRequest(
        credits_package=500,
        payment_method="credit_card",
        card_token="12345678901234567890123456789012",  # Exact 32 chars
        payer_email="customer@test.com",
    )

    res = await service.create_recharge_payment(tenant_id="tenant_qa", payload=req)

    assert isinstance(res, RechargeResponse)
    assert res.payment_id == "mp_card_888"
    assert res.status == "processed"

    checkout_mock.create_credit_card_payment.assert_awaited_once()
    card_input = checkout_mock.create_credit_card_payment.call_args.kwargs["input_data"]
    assert card_input.total_amount == 80.0
    assert card_input.card_token == "12345678901234567890123456789012"

    # Como o pagamento foi PROCESSED, deve ter adicionado os créditos automaticamente na carteira
    credit_mock.add_credits.assert_awaited_once_with(
        tenant_id="tenant_qa",
        amount=500,
        description="Recarga de 500 créditos (Cartão)",
        external_payment_id="mp_card_888",
    )


@pytest.mark.asyncio
async def test_create_recharge_payment_invalid_package_raises_400() -> None:
    session = AsyncMock(spec=AsyncSession)
    checkout_mock = AsyncMock(spec=CheckoutService)

    service = RechargeService(session=session, checkout_service=checkout_mock)
    req = RechargeRequest(
        credits_package=350,  # Não é 100, 500 ou 1000
        payment_method="pix",
        payer_email="customer@test.com",
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.create_recharge_payment(tenant_id="tenant_qa", payload=req)

    assert exc_info.value.status_code == 400
    assert "Pacote de créditos inválido" in exc_info.value.detail
    checkout_mock.create_pix_payment.assert_not_called()
