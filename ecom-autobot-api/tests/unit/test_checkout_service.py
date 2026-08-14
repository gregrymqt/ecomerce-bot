from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.features.checkout.domain.enums import OrderStatus, OrderStatusDetail, PaymentMethodId
from app.features.checkout.domain.exceptions import (
    OrderCancellationError,
    OrderNotFoundError,
    OrderRefundError,
    PaymentProcessingError,
)
from app.features.checkout.domain.models import OrderModel
from app.features.checkout.schemas.common import OrderItemSchema
from app.features.checkout.schemas.service_schemas import (
    CreateCreditCardCheckoutInput,
    CreatePixCheckoutInput,
    CustomerDTO,
)
from app.features.checkout.services.checkout_service import (
    CheckoutService,
    get_friendly_credit_card_error_message,
)


def test_friendly_credit_card_error_messages():
    msg_card_num = get_friendly_credit_card_error_message("cc_rejected_bad_filled_card_number")
    assert "número do cartão de crédito é inválido" in msg_card_num

    msg_insufficient = get_friendly_credit_card_error_message("cc_rejected_insufficient_amount")
    assert "Saldo ou limite insuficiente" in msg_insufficient

    msg_unknown = get_friendly_credit_card_error_message("unknown_detail_code")
    assert "recusado pela operadora" in msg_unknown


@pytest.mark.asyncio
async def test_create_pix_payment_success():
    mock_session = AsyncMock()
    mock_order_repo = AsyncMock()

    mock_mp_response = MagicMock()
    mock_mp_response.id = "ORD_MP_12345"
    mock_mp_response.status = OrderStatus.CREATED
    mock_mp_response.status_detail = OrderStatusDetail.WAITING_PAYMENT
    mock_mp_response.total_paid_amount = "0.00"
    mock_mp_response.model_dump.return_value = {}

    payment_info = MagicMock()
    payment_info.date_of_expiration = "2026-12-31T23:59:59+00:00"
    payment_method_data = MagicMock()
    payment_method_data.qr_code = "00020126580014BR.GOV.BCB.PIX..."
    payment_method_data.qr_code_base64 = "iVBORw0KGgoAAAANSUhEUg..."
    payment_info.payment_method = payment_method_data
    mock_mp_response.transactions.payments = [payment_info]

    input_data = CreatePixCheckoutInput(
        external_reference="PEDIDO_1001",
        total_amount=Decimal("150.00"),
        customer=CustomerDTO(
            email="cliente@teste.com",
            first_name="João",
            last_name="Silva",
            document_type="CPF",
            document_number="12345678900",
        ),
        items=[
            OrderItemSchema(
                title="Camiseta Algodão",
                unit_price="150.00",
                quantity=1,
            )
        ],
    )

    with patch("app.features.checkout.services.checkout_service._get_order_client") as mock_client_factory:
        mock_client = AsyncMock()
        mock_client.create_order.return_value = mock_mp_response
        mock_client_factory.return_value.__aenter__.return_value = mock_client

        service = CheckoutService(mock_session)
        service.order_repo = mock_order_repo

        result = await service.create_pix_payment(tenant_id="tenant_abc", input_data=input_data)

        assert result.mp_order_id == "ORD_MP_12345"
        assert result.external_reference == "PEDIDO_1001"
        assert result.pix_qr_code == "00020126580014BR.GOV.BCB.PIX..."
        assert result.pix_qr_code_base64 == "iVBORw0KGgoAAAANSUhEUg..."
        mock_order_repo.save.assert_called_once()
        mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_create_pix_payment_mp_failure_raises_domain_exception():
    mock_session = AsyncMock()

    input_data = CreatePixCheckoutInput(
        external_reference="PEDIDO_FAIL",
        total_amount=Decimal("100.00"),
        customer=CustomerDTO(
            email="cliente@teste.com",
            first_name="João",
            last_name="Silva",
            document_type="CPF",
            document_number="12345678900",
        ),
        items=[OrderItemSchema(title="Item Teste", unit_price="100.00", quantity=1)],
    )

    with patch("app.features.checkout.services.checkout_service._get_order_client") as mock_client_factory:
        mock_client = AsyncMock()
        mock_client.create_order.side_effect = Exception("Erro de Conexão com MP")
        mock_client_factory.return_value.__aenter__.return_value = mock_client

        service = CheckoutService(mock_session)

        with pytest.raises(PaymentProcessingError) as exc_info:
            await service.create_pix_payment(tenant_id="tenant_abc", input_data=input_data)

        assert "Falha ao gerar cobrança PIX" in exc_info.value.message


@pytest.mark.asyncio
async def test_cancel_order_not_found_raises_domain_exception():
    mock_session = AsyncMock()
    mock_order_repo = AsyncMock()
    mock_order_repo.get_by_id.return_value = None

    service = CheckoutService(mock_session)
    service.order_repo = mock_order_repo

    with pytest.raises(OrderNotFoundError) as exc_info:
        await service.cancel_order(tenant_id="tenant_abc", order_id="ord_inexistente")

    assert "ord_inexistente" in exc_info.value.message


@pytest.mark.asyncio
async def test_cancel_order_mp_failure_raises_domain_exception():
    mock_session = AsyncMock()
    mock_order_repo = AsyncMock()

    existing_order = OrderModel(
        id="ord_123",
        tenant_id="tenant_abc",
        mp_order_id="ORD_MP_999",
        external_reference="REF_123",
        status=OrderStatus.CREATED,
        total_amount=Decimal("50.00"),
        payer_email="teste@teste.com",
    )
    mock_order_repo.get_by_id.return_value = existing_order

    with patch("app.features.checkout.services.checkout_service._get_order_client") as mock_client_factory:
        mock_client = AsyncMock()
        mock_client.cancel_order.side_effect = Exception("API MP indispónivel")
        mock_client_factory.return_value.__aenter__.return_value = mock_client

        service = CheckoutService(mock_session)
        service.order_repo = mock_order_repo

        with pytest.raises(OrderCancellationError) as exc_info:
            await service.cancel_order(tenant_id="tenant_abc", order_id="ord_123")

        assert "Não foi possível cancelar o pedido no Mercado Pago" in exc_info.value.message


@pytest.mark.asyncio
async def test_refund_order_not_found_raises_domain_exception():
    mock_session = AsyncMock()
    mock_order_repo = AsyncMock()
    mock_order_repo.get_by_id.return_value = None

    service = CheckoutService(mock_session)
    service.order_repo = mock_order_repo

    with pytest.raises(OrderNotFoundError) as exc_info:
        await service.refund_order(tenant_id="tenant_abc", order_id="ord_inexistente")

    assert "ord_inexistente" in exc_info.value.message


@pytest.mark.asyncio
async def test_refund_order_mp_failure_raises_domain_exception():
    mock_session = AsyncMock()
    mock_order_repo = AsyncMock()

    existing_order = OrderModel(
        id="ord_refund_123",
        tenant_id="tenant_abc",
        mp_order_id="ORD_MP_REFUND_999",
        external_reference="REF_999",
        status=OrderStatus.PROCESSED,
        total_amount=Decimal("200.00"),
        payer_email="teste@teste.com",
        raw_mp_response={"transactions": {"payments": [{"id": "PAY_123"}]}},
    )
    mock_order_repo.get_by_id.return_value = existing_order

    with patch("app.features.checkout.services.checkout_service._get_order_client") as mock_client_factory:
        mock_client = AsyncMock()
        mock_client.refund_order.side_effect = Exception("Erro MP Refund")
        mock_client_factory.return_value.__aenter__.return_value = mock_client

        service = CheckoutService(mock_session)
        service.order_repo = mock_order_repo

        with pytest.raises(OrderRefundError) as exc_info:
            await service.refund_order(tenant_id="tenant_abc", order_id="ord_refund_123")

        assert "Não foi possível processar o reembolso no Mercado Pago" in exc_info.value.message
