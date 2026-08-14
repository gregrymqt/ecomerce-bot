import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING

if TYPE_CHECKING:
    from app.features.checkout.infrastructure.client import MercadoPagoOrderClient

from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.features.checkout.domain.enums import (
    CaptureMode,
    OrderStatus,
    OrderStatusDetail,
    OrderType,
    PaymentMethodId,
    PaymentMethodType,
    ProcessingMode,
)
from app.features.checkout.domain.exceptions import (
    OrderCancellationError,
    OrderNotFoundError,
    OrderRefundError,
    PaymentProcessingError,
)
from app.features.checkout.domain.models import OrderItemModel, OrderModel
from app.features.checkout.repositories.order_repository import OrderRepository
from app.features.checkout.schemas import (
    CreateMPOrderRequest,
    CreateMPOrderResponse,
    PayerIdentificationSchema,
    PayerInputSchema,
    PaymentInputSchema,
    PaymentMethodInputSchema,
    RefundMPOrderRequest,
    RefundTransactionInputSchema,
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


class CheckoutService:
    """
    Serviço de Domínio/Aplicação para gestão de Checkout Transparente.
    Orquestra validações, comunicação com o Mercado Pago e persistência local/cache.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.order_repo = OrderRepository(session)

    # ==========================================
    # CASO DE USO 1: PROCESSAR PAGAMENTO VIA PIX
    # ==========================================

    async def create_pix_payment(
        self, tenant_id: str, input_data: CreatePixCheckoutInput
    ) -> CheckoutResultOutput:
        """Gera a preferência/order de pagamento instantâneo via PIX com QR Code e Copia e Cola."""
        
        # 1. Monta o DTO de requisição específico para a API de Orders do Mercado Pago
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

        # 2. Comunica com a API do Mercado Pago
        try:
            async with _get_order_client() as mp_client:
                mp_response: CreateMPOrderResponse = await mp_client.create_order(order_request=mp_request)
        except Exception as exc:
            logger.error(f"[CheckoutService] Erro ao comunicar com Mercado Pago para PIX: {exc}")
            raise PaymentProcessingError(f"Falha ao gerar cobrança PIX: {str(exc)}")

        # 3. Extrai dados do PIX (QR Code, Copia e Cola)
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

        # 4. Instancia a Entidade de Banco de Dados local
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

        # 5. Persiste no PostgreSQL com resiliência transacional e compensação remota se falhar
        try:
            await self.order_repo.save(order_entity)
            await self.session.commit()
        except Exception as db_err:
            await self.session.rollback()
            logger.critical(
                f"[CheckoutService] Falha ao persistir pedido PIX '{internal_order_id}' no banco local (MP Order: '{mp_response.id}'): {db_err}"
            )
            try:
                async with _get_order_client() as mp_client:
                    await mp_client.cancel_order(order_id=mp_response.id)
                logger.info(f"[CheckoutService] Compensação executada: Pedido MP '{mp_response.id}' cancelado com sucesso no Mercado Pago.")
            except Exception as cancel_err:
                logger.error(f"[CheckoutService] ALERTA DE INCONSISTÊNCIA: Falha na compensação remota do pedido MP '{mp_response.id}': {cancel_err}")
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

    # ===================================================
    # CASO DE USO 2: PROCESSAR PAGAMENTO VIA CARTÃO CRÉDITO
    # ===================================================

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
            logger.error(f"[CheckoutService] Erro ao comunicar com Mercado Pago para Cartão de Crédito: {exc}")
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

        # 5. Persiste no PostgreSQL com resiliência transacional e compensação remota se falhar
        try:
            await self.order_repo.save(order_entity)
            await self.session.commit()
        except Exception as db_err:
            await self.session.rollback()
            logger.critical(
                f"[CheckoutService] Falha ao persistir pedido Cartão '{internal_order_id}' no banco local (MP Order: '{mp_response.id}'): {db_err}"
            )
            try:
                async with _get_order_client() as mp_client:
                    await mp_client.cancel_order(order_id=mp_response.id)
                logger.info(f"[CheckoutService] Compensação executada: Pedido MP '{mp_response.id}' cancelado com sucesso no Mercado Pago.")
            except Exception as cancel_err:
                logger.error(f"[CheckoutService] ALERTA DE INCONSISTÊNCIA: Falha na compensação remota do pedido MP '{mp_response.id}': {cancel_err}")
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

    # ==========================================================
    # CASO DE USO 3: SINCRONIZAR STATUS DA ORDER (WEBHOOK / POLLING)
    # ==========================================================

    async def sync_order_status_from_mp(
        self, tenant_id: str, mp_order_id: str
    ) -> Optional[OrderModel]:
        """
        Consulta o Mercado Pago e atualiza o estado real do pedido no Banco e Cache Redis.
        Essencial para o manipulador de Webhooks.
        """
        # 1. Consulta o Mercado Pago diretamente (Zero Trust no payload do Webhook)
        async with _get_order_client() as mp_client:
            mp_order = await mp_client.get_order_by_id(order_id=mp_order_id)

        # 2. Busca a Order localmente pelo mp_order_id ou external_reference
        local_order = await self.order_repo.get_by_mp_order_id(tenant_id, mp_order_id)
        if not local_order and mp_order.external_reference:
            local_order = await self.order_repo.get_by_external_reference(
                tenant_id, mp_order.external_reference
            )

        if not local_order:
            logger.error(
                f"[CheckoutService] Order MP {mp_order_id} recebida no webhook não encontrada localmente."
            )
            raise OrderNotFoundError(mp_order_id)

        # 3. Verifica transição de estado e idempotência antes de atualizar o banco
        new_status = OrderStatus(mp_order.status.value)
        new_status_detail = OrderStatusDetail(mp_order.status_detail.value) if mp_order.status_detail else None
        new_total_paid = Decimal(mp_order.total_paid_amount or "0.00")

        if (
            local_order.status == new_status
            and local_order.status_detail == new_status_detail
            and local_order.total_paid_amount == new_total_paid
        ):
            logger.info(
                f"[CheckoutService] Order {local_order.id} (MP: {mp_order_id}) já possui o status '{new_status}'. Nenhuma alteração relacional necessária (Idempotent State Hit)."
            )
            return local_order

        # Atualiza os campos de estado apenas se houver transição real
        local_order.status = new_status
        if new_status_detail:
            local_order.status_detail = new_status_detail
        
        local_order.total_paid_amount = new_total_paid
        local_order.raw_mp_response = mp_order.model_dump(mode="json")
        local_order.updated_at = datetime.now(timezone.utc)

        # 4. Atualiza DB e inverte/atualiza Cache Redis
        await self.order_repo.update(local_order)
        await self.session.commit()

        # 5. Se o pedido foi aprovado/processado, credita os créditos na carteira do tenant se for recarga
        if new_status == OrderStatus.PROCESSED:
            await self._fulfill_wallet_recharge_if_needed(local_order)

        logger.info(
            f"[CheckoutService] Order {local_order.id} sincronizada com sucesso. Status='{local_order.status}'"
        )
        return local_order

    async def _fulfill_wallet_recharge_if_needed(self, order: OrderModel) -> None:
        """
        Verifica se a order aprovada é uma recarga de créditos da carteira pré-paga
        e credita os pontos no saldo do tenant.
        """
        try:
            credits_to_add = 0
            if order.external_reference and order.external_reference.startswith("{"):
                try:
                    import json
                    ref_data = json.loads(order.external_reference)
                    if isinstance(ref_data, dict) and "credits" in ref_data:
                        credits_to_add = int(ref_data["credits"])
                except Exception:
                    pass

            if credits_to_add == 0 and order.items:
                for item in order.items:
                    if item.external_code and item.external_code.startswith("pkg_"):
                        try:
                            credits_to_add += int(item.external_code.replace("pkg_", ""))
                        except Exception:
                            pass

            if credits_to_add > 0:
                logger.info(
                    f"[CheckoutService] Creditando {credits_to_add} créditos para tenant '{order.tenant_id}' (Order: '{order.id}', MP: '{order.mp_order_id}')"
                )
                from app.features.wallet.repositories import WalletRepository
                from app.features.wallet.services import CreditService

                credit_service = CreditService(WalletRepository(self.session))
                updated_wallet = await credit_service.add_credits(
                    tenant_id=order.tenant_id,
                    amount=credits_to_add,
                    description=f"Recarga via Mercado Pago Order #{order.mp_order_id or order.id}",
                    external_payment_id=order.mp_order_id or order.id,
                )

                # Disparo assíncrono de e-mail de confirmação de recarga
                from app.features.emails.services.email_dispatcher import email_dispatcher
                await email_dispatcher.publish_email_event(
                    event_name="RECHARGE_CONFIRMED",
                    recipient_email=order.payer_email,
                    tenant_id=order.tenant_id,
                    data={
                        "order_id": order.id,
                        "mp_order_id": order.mp_order_id,
                        "credits_added": credits_to_add,
                        "amount_paid_brl": float(order.total_amount) if order.total_amount else 0.0,
                        "payment_method": order.payment_method_type.value if hasattr(order.payment_method_type, "value") else str(order.payment_method_type),
                        "new_balance": updated_wallet.balance_credits if updated_wallet else 0,
                    },
                )
        except Exception as err:
            logger.error(
                f"[CheckoutService] Erro ao creditar carteira para order '{order.id}': {err}"
            )

    # ==========================================
    # CASO DE USO 4: CANCELAR E REEMBOLSAR ORDER
    # ==========================================

    async def cancel_order(self, tenant_id: str, order_id: str) -> bool:
        """Cancela uma order pendente localmente e no Mercado Pago."""
        local_order = await self.order_repo.get_by_id(tenant_id, order_id)
        if not local_order or not local_order.mp_order_id:
            raise OrderNotFoundError(order_id)

        try:
            async with _get_order_client() as mp_client:
                await mp_client.cancel_order(order_id=local_order.mp_order_id)
        except Exception as mp_err:
            logger.error(f"[CheckoutService] Erro ao cancelar pedido MP '{local_order.mp_order_id}': {mp_err}")
            raise OrderCancellationError(f"Não foi possível cancelar o pedido no Mercado Pago: {str(mp_err)}")

        local_order.status = OrderStatus.CANCELED
        local_order.status_detail = OrderStatusDetail.CANCELED
        await self.order_repo.update(local_order)
        await self.session.commit()
        return True

    async def refund_order(
        self, tenant_id: str, order_id: str, amount: Optional[Decimal] = None
    ) -> bool:
        """Executa o estorno/reembolso de um pagamento aprovado."""
        local_order = await self.order_repo.get_by_id(tenant_id, order_id)
        if not local_order or not local_order.mp_order_id:
            raise OrderNotFoundError(order_id)

        refund_req = None
        if amount and local_order.raw_mp_response:
            payments = local_order.raw_mp_response.get("transactions", {}).get("payments", [])
            if payments:
                pay_id = payments[0].get("id")
                refund_req = RefundMPOrderRequest(
                    transactions=[RefundTransactionInputSchema(id=pay_id, amount=f"{amount:.2f}")]
                )

        try:
            async with _get_order_client() as mp_client:
                await mp_client.refund_order(order_id=local_order.mp_order_id, refund_request=refund_req)
        except Exception as mp_err:
            logger.error(f"[CheckoutService] Erro ao reembolsar pedido MP '{local_order.mp_order_id}': {mp_err}")
            raise OrderRefundError(f"Não foi possível processar o reembolso no Mercado Pago: {str(mp_err)}")

        await self.sync_order_status_from_mp(tenant_id, local_order.mp_order_id)
        return True