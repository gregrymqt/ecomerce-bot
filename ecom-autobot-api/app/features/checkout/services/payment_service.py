import logging
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from app.features.checkout.infrastructure.client import MercadoPagoOrderClient

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.checkout.domain.enums import (
    CaptureMode,
    OrderStatus,
    OrderType,
    PaymentMethodId,
    PaymentMethodType,
    ProcessingMode,
)
from app.features.checkout.domain.exceptions import PaymentProcessingError
from app.features.checkout.domain.models import OrderItemModel, OrderModel
from app.features.checkout.repositories.order_repository import OrderRepository
from app.features.checkout.schemas import (
    CreateMPOrderRequest,
    CreateMPOrderResponse,
    PayerIdentificationSchema,
    PayerInputSchema,
    PaymentInputSchema,
    PaymentMethodInputSchema,
    ShipmentInputSchema,
    TransactionsInputSchema,
)
from app.features.checkout.schemas.service_schemas import (
    CheckoutResultOutput,
    CreateCreditCardCheckoutInput,
    CreatePixCheckoutInput,
)

logger = logging.getLogger(__name__)


def _get_order_client():
    from app.features.checkout.infrastructure.client import MercadoPagoOrderClient
    return MercadoPagoOrderClient()


REJECTED_PAYMENT_MESSAGES = {
    "cc_rejected_bad_filled_card_number": "O número do cartão de crédito é inválido. Por favor, verifique os dígitos digitados.",
    "cc_rejected_bad_filled_date": "A data de vencimento informada é inválida.",
    "cc_rejected_bad_filled_other": "Os dados do cartão estão incorretos. Por favor, revise as informações preenchidas.",
    "cc_rejected_bad_filled_security_code": "O código de segurança (CVV) informado é inválido.",
    "cc_rejected_blacklist": "Este cartão não pôde ser processado. Por favor, utilize outro cartão ou meio de pagamento.",
    "cc_rejected_call_for_authorize": "Pagamento pendente de autorização. Entre em contato com a operadora do seu cartão para autorizar.",
    "cc_rejected_card_disabled": "Este cartão está desabilitado ou inativo. Entre em contato com o seu banco emissor.",
    "cc_rejected_card_error": "Não foi possível processar a cobrança no cartão. Tente novamente ou utilize outro cartão.",
    "cc_rejected_duplicated_payment": "Detectamos um pagamento duplicado em um curto intervalo de tempo. Aguarde alguns instantes.",
    "cc_rejected_high_risk": "O pagamento foi recusado por políticas de segurança e prevenção a fraudes.",
    "cc_rejected_insufficient_amount": "Saldo ou limite insuficiente no cartão de crédito fornecido.",
    "cc_rejected_invalid_installments": "O número de parcelas selecionado não é permitido para este cartão.",
    "cc_rejected_max_attempts": "Você atingiu o limite máximo de tentativas. Por favor, aguarde alguns minutos e tente novamente.",
}


def get_friendly_credit_card_error_message(status_detail: Optional[str]) -> str:
    if not status_detail:
        return "Não foi possível processar o pagamento com o cartão fornecido."
    return REJECTED_PAYMENT_MESSAGES.get(
        status_detail.lower(),
        "O pagamento no cartão foi recusado pela operadora ou banco emissor."
    )


class PaymentService:
    """
    Serviço de Domínio responsável pelo processamento de pagamentos (PIX e Cartão de Crédito).
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.order_repo = OrderRepository(session)

    async def create_pix_payment(
        self, tenant_id: str, input_data: CreatePixCheckoutInput
    ) -> CheckoutResultOutput:
        """Gera a preferência/order de pagamento instantâneo via PIX com QR Code e Copia e Cola."""
        mp_request = CreateMPOrderRequest(
            type=OrderType.ONLINE,
            external_reference=input_data.external_reference,
            total_amount=f"{input_data.total_amount:.2f}",
            capture_mode=CaptureMode.AUTOMATIC,
            processing_mode=ProcessingMode.AUTOMATIC,
            description=f"Pedido {input_data.external_reference}",
            payer=PayerInputSchema(
                email=input_data.customer.email,
                first_name=input_data.customer.first_name,
                last_name=input_data.customer.last_name,
                identification=PayerIdentificationSchema(
                    type=input_data.customer.document_type,
                    number=input_data.customer.document_number,
                ),
            ),
            transactions=TransactionsInputSchema(
                payments=PaymentInputSchema(
                    amount=f"{input_data.total_amount:.2f}",
                    expiration_time=input_data.expiration_time_iso,
                    payment_method=PaymentMethodInputSchema(
                        id=PaymentMethodId.PIX,
                        type=PaymentMethodType.BANK_TRANSFER,
                    ),
                )
            ),
            shipment=ShipmentInputSchema(address=input_data.shipping_address) if input_data.shipping_address else None,
            items=input_data.items,
        )

        try:
            async with _get_order_client() as mp_client:
                mp_response: CreateMPOrderResponse = await mp_client.create_order(order_request=mp_request)
        except Exception as exc:
            logger.error(f"[PaymentService] Erro ao comunicar com Mercado Pago para PIX: {exc}")
            raise PaymentProcessingError(f"Falha ao gerar cobrança PIX: {str(exc)}")

        payment_info = mp_response.transactions.payments[0]
        payment_method_data = payment_info.payment_method

        pix_qr_code = payment_method_data.qr_code if payment_method_data else None
        pix_qr_code_base64 = payment_method_data.qr_code_base64 if payment_method_data else None

        pix_expiration = None
        if payment_info.date_of_expiration and isinstance(payment_info.date_of_expiration, str):
            try:
                pix_expiration = datetime.fromisoformat(payment_info.date_of_expiration)
            except (ValueError, TypeError):
                pass

        internal_order_id = f"ord_{uuid.uuid4().hex[:16]}"
        order_entity = OrderModel(
            id=internal_order_id,
            tenant_id=tenant_id,
            mp_order_id=mp_response.id,
            external_reference=input_data.external_reference,
            status=mp_response.status,
            status_detail=mp_response.status_detail,
            payment_method_type=PaymentMethodType.BANK_TRANSFER,
            total_amount=input_data.total_amount,
            total_paid_amount=Decimal(mp_response.total_paid_amount or "0.00"),
            payer_email=input_data.customer.email,
            payer_document_type=input_data.customer.document_type,
            payer_document_number=input_data.customer.document_number,
            pix_qr_code=pix_qr_code,
            pix_qr_code_base64=pix_qr_code_base64,
            pix_expiration_date=pix_expiration,
            raw_mp_response=mp_response.model_dump(mode="json"),
            items=[
                OrderItemModel(
                    title=item.title,
                    unit_price=Decimal(item.unit_price),
                    quantity=item.quantity,
                    external_code=item.external_code,
                )
                for item in input_data.items
            ],
        )

        try:
            await self.order_repo.save(order_entity)
            await self.session.commit()
        except Exception as db_err:
            await self.session.rollback()
            logger.critical(
                f"[PaymentService] Falha ao persistir pedido PIX '{internal_order_id}' no banco local (MP Order: '{mp_response.id}'): {db_err}"
            )
            try:
                async with _get_order_client() as mp_client:
                    await mp_client.cancel_order(order_id=mp_response.id)
                logger.info(f"[PaymentService] Compensação executada: Pedido MP '{mp_response.id}' cancelado com sucesso no Mercado Pago.")
            except Exception as cancel_err:
                logger.error(f"[PaymentService] ALERTA DE INCONSISTÊNCIA: Falha na compensação remota do pedido MP '{mp_response.id}': {cancel_err}")
            raise PaymentProcessingError(f"Falha ao salvar pedido PIX no banco local: {str(db_err)}")

        return CheckoutResultOutput(
            order_id=internal_order_id,
            mp_order_id=mp_response.id,
            external_reference=input_data.external_reference,
            status=mp_response.status,
            status_detail=mp_response.status_detail,
            total_amount=input_data.total_amount,
            pix_qr_code=pix_qr_code,
            pix_qr_code_base64=pix_qr_code_base64,
            pix_expiration_date=pix_expiration,
        )

    async def create_credit_card_payment(
        self, tenant_id: str, input_data: CreateCreditCardCheckoutInput
    ) -> CheckoutResultOutput:
        """Processa a cobrança direta no cartão de crédito via token gerado no frontend."""
        mp_request = CreateMPOrderRequest(
            type=OrderType.ONLINE,
            external_reference=input_data.external_reference,
            total_amount=f"{input_data.total_amount:.2f}",
            capture_mode=CaptureMode.AUTOMATIC,
            processing_mode=ProcessingMode.AUTOMATIC,
            description=f"Pedido {input_data.external_reference}",
            payer=PayerInputSchema(
                email=input_data.customer.email,
                first_name=input_data.customer.first_name,
                last_name=input_data.customer.last_name,
                identification=PayerIdentificationSchema(
                    type=input_data.customer.document_type,
                    number=input_data.customer.document_number,
                ),
            ),
            transactions=TransactionsInputSchema(
                payments=PaymentInputSchema(
                    amount=f"{input_data.total_amount:.2f}",
                    payment_method=PaymentMethodInputSchema(
                        id=input_data.payment_method_id,
                        type=PaymentMethodType.CREDIT_CARD,
                        token=input_data.card_token,
                        installments=input_data.installments,
                        statement_descriptor=input_data.statement_descriptor or "E-Commerce",
                    ),
                )
            ),
            items=input_data.items,
        )

        try:
            async with _get_order_client() as mp_client:
                mp_response: CreateMPOrderResponse = await mp_client.create_order(order_request=mp_request)
        except Exception as exc:
            logger.error(f"[PaymentService] Erro ao comunicar com Mercado Pago para Cartão de Crédito: {exc}")
            raise PaymentProcessingError(f"Falha ao processar pagamento com cartão: {str(exc)}")

        internal_order_id = f"ord_{uuid.uuid4().hex[:16]}"
        order_entity = OrderModel(
            id=internal_order_id,
            tenant_id=tenant_id,
            mp_order_id=mp_response.id,
            external_reference=input_data.external_reference,
            status=mp_response.status,
            status_detail=mp_response.status_detail,
            payment_method_type=PaymentMethodType.CREDIT_CARD,
            total_amount=input_data.total_amount,
            total_paid_amount=Decimal(mp_response.total_paid_amount or "0.00"),
            payer_email=input_data.customer.email,
            payer_document_type=input_data.customer.document_type,
            payer_document_number=input_data.customer.document_number,
            raw_mp_response=mp_response.model_dump(mode="json"),
            items=[
                OrderItemModel(
                    title=item.title,
                    unit_price=Decimal(item.unit_price),
                    quantity=item.quantity,
                    external_code=item.external_code,
                )
                for item in input_data.items
            ],
        )

        try:
            await self.order_repo.save(order_entity)
            await self.session.commit()
        except Exception as db_err:
            await self.session.rollback()
            logger.critical(
                f"[PaymentService] Falha ao persistir pedido Cartão '{internal_order_id}' no banco local (MP Order: '{mp_response.id}'): {db_err}"
            )
            try:
                async with _get_order_client() as mp_client:
                    await mp_client.cancel_order(order_id=mp_response.id)
                logger.info(f"[PaymentService] Compensação executada: Pedido MP '{mp_response.id}' cancelado com sucesso no Mercado Pago.")
            except Exception as cancel_err:
                logger.error(f"[PaymentService] ALERTA DE INCONSISTÊNCIA: Falha na compensação remota do pedido MP '{mp_response.id}': {cancel_err}")
            raise PaymentProcessingError(f"Falha ao salvar pedido de cartão no banco local: {str(db_err)}")

        user_msg = None
        detail_str = mp_response.status_detail.value if mp_response.status_detail else None
        if mp_response.status != OrderStatus.PROCESSED:
            user_msg = get_friendly_credit_card_error_message(detail_str)

        return CheckoutResultOutput(
            order_id=internal_order_id,
            mp_order_id=mp_response.id,
            external_reference=input_data.external_reference,
            status=mp_response.status,
            status_detail=mp_response.status_detail,
            total_amount=input_data.total_amount,
            user_message=user_msg,
        )
