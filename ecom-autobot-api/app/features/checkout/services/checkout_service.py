import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List

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
from app.features.checkout.domain.models import OrderItemModel, OrderModel
from app.features.checkout.infrastructure.client import MercadoPagoOrderClient
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
        async with MercadoPagoOrderClient() as mp_client:
            mp_response: CreateMPOrderResponse = await mp_client.create_order(order_request=mp_request)

        # 3. Extrai dados do PIX (QR Code, Copia e Cola)
        payment_info = mp_response.transactions.payments[0]
        payment_method_data = payment_info.payment_method

        pix_qr_code = payment_method_data.qr_code if payment_method_data else None
        pix_qr_code_base64 = payment_method_data.qr_code_base64 if payment_method_data else None
        
        pix_expiration = None
        if payment_info.date_of_expiration:
            try:
                pix_expiration = datetime.fromisoformat(payment_info.date_of_expiration)
            except ValueError:
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

        # 5. Persiste no PostgreSQL (que atualiza o Cache Redis via OrderRepository)
        await self.order_repo.save(order_entity)
        await self.session.commit()

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

        async with MercadoPagoOrderClient() as mp_client:
            mp_response: CreateMPOrderResponse = await mp_client.create_order(order_request=mp_request)

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

        await self.order_repo.save(order_entity)
        await self.session.commit()

        return CheckoutResultOutput(
            order_id=internal_order_id,
            mp_order_id=mp_response.id,
            external_reference=input_data.external_reference,
            status=mp_response.status,
            status_detail=mp_response.status_detail,
            total_amount=input_data.total_amount,
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
        async with MercadoPagoOrderClient() as mp_client:
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
            return None

        # 3. Atualiza os campos de estado
        local_order.status = OrderStatus(mp_order.status.value)
        if mp_order.status_detail:
            local_order.status_detail = OrderStatusDetail(mp_order.status_detail.value)
        
        local_order.total_paid_amount = Decimal(mp_order.total_paid_amount or "0.00")
        local_order.raw_mp_response = mp_order.model_dump(mode="json")
        local_order.updated_at = datetime.now(timezone.utc)

        # 4. Atualiza DB e inverte/atualiza Cache Redis
        await self.order_repo.update(local_order)
        await self.session.commit()

        logger.info(
            f"[CheckoutService] Order {local_order.id} sincronizada com sucesso. Status='{local_order.status}'"
        )
        return local_order

    # ==========================================
    # CASO DE USO 4: CANCELAR E REEMBOLSAR ORDER
    # ==========================================

    async def cancel_order(self, tenant_id: str, order_id: str) -> bool:
        """Cancela uma order pendente localmente e no Mercado Pago."""
        local_order = await self.order_repo.get_by_id(tenant_id, order_id)
        if not local_order or not local_order.mp_order_id:
            return False

        async with MercadoPagoOrderClient() as mp_client:
            await mp_client.cancel_order(order_id=local_order.mp_order_id)

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
            return False

        refund_req = None
        if amount and local_order.raw_mp_response:
            # Tenta resgatar o ID da transação original
            payments = local_order.raw_mp_response.get("transactions", {}).get("payments", [])
            if payments:
                pay_id = payments[0].get("id")
                refund_req = RefundMPOrderRequest(
                    transactions=[RefundTransactionInputSchema(id=pay_id, amount=f"{amount:.2f}")]
                )

        async with MercadoPagoOrderClient() as mp_client:
            await mp_client.refund_order(order_id=local_order.mp_order_id, refund_request=refund_req)

        # Sincroniza o novo estado de reembolso
        await self.sync_order_status_from_mp(tenant_id, local_order.mp_order_id)
        return True