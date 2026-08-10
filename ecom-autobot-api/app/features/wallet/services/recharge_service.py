import json
import logging
import uuid
from decimal import Decimal
from typing import Dict, Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.checkout.domain.enums import OrderStatus, PaymentMethodId
from app.features.checkout.schemas.common import OrderItemSchema
from app.features.checkout.schemas.service_schemas import (
    CreateCreditCardCheckoutInput,
    CreatePixCheckoutInput,
    CustomerDTO,
)
from app.features.checkout.services.checkout_service import CheckoutService
from app.features.wallet.repositories import WalletRepository
from app.features.wallet.schemas import RechargeRequest, RechargeResponse
from app.features.wallet.services.credit_service import CreditService

logger = logging.getLogger(__name__)

# Tabela de preços/pacotes fixos: {créditos: valor em BRL (float)}
CREDIT_PACKAGES: Dict[int, float] = {
    100: 20.0,    # 100 créditos = R$ 20,00
    500: 80.0,    # 500 créditos = R$ 80,00
    1000: 150.0,  # 1000 créditos = R$ 150,00
}


class RechargeService:
    """
    Serviço de recarga de créditos avulsos integrado com o motor de Checkout (CheckoutService).
    Processa cobranças via Pix e Cartão de Crédito salvando pedidos auditáveis em checkout_orders
    e creditando a carteira do tenant de forma automática e segura.
    """

    def __init__(
        self,
        session: AsyncSession,
        checkout_service: Optional[CheckoutService] = None,
        credit_service: Optional[CreditService] = None,
    ) -> None:
        self.session = session
        self.checkout_service = checkout_service or CheckoutService(session)
        self.credit_service = credit_service or CreditService(WalletRepository(session))

    async def create_recharge_payment(
        self, tenant_id: str, payload: RechargeRequest
    ) -> RechargeResponse:
        """
        Valida o pacote de créditos, delega a criação do pagamento ao CheckoutService,
        credita a carteira do tenant se aprovado e retorna a resposta formatada em RechargeResponse.
        """
        # 1. Valida se o pacote de créditos é suportado
        if payload.credits_package not in CREDIT_PACKAGES:
            valid_packages = list(CREDIT_PACKAGES.keys())
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Pacote de créditos inválido. Pacotes aceitos: {valid_packages}",
            )

        amount_brl = CREDIT_PACKAGES[payload.credits_package]
        ref_id = f"recharge_{uuid.uuid4().hex[:12]}"
        external_reference = json.dumps({
            "tenant_id": tenant_id,
            "credits": payload.credits_package,
            "ref_id": ref_id,
        })

        customer = CustomerDTO(
            email=payload.payer_email,
            first_name="Cliente",
            last_name=tenant_id,
            document_type="CPF",
            document_number="00000000000",
        )

        item = OrderItemSchema(
            title=f"Recarga de {payload.credits_package} créditos",
            unit_price=f"{amount_brl:.2f}",
            quantity=1,
            external_code=f"pkg_{payload.credits_package}",
        )

        logger.info(
            f"[RechargeService] Processando recarga | Tenant: '{tenant_id}' | "
            f"Pacote: {payload.credits_package} cr (R$ {amount_brl}) | Método: {payload.payment_method}"
        )

        # 2. Processa pagamento via PIX
        if payload.payment_method == "pix":
            pix_input = CreatePixCheckoutInput(
                external_reference=external_reference,
                total_amount=Decimal(str(amount_brl)),
                customer=customer,
                items=[item],
            )
            result = await self.checkout_service.create_pix_payment(
                tenant_id=tenant_id, input_data=pix_input
            )

            status_str = result.status.value if isinstance(result.status, OrderStatus) else str(result.status)
            return RechargeResponse(
                payment_id=result.mp_order_id or result.order_id,
                status=status_str,
                pix_qr_code=result.pix_qr_code_base64,
                pix_copia_e_cola=result.pix_qr_code,
                expiration_date=result.pix_expiration_date,
            )

        # 3. Processa pagamento via Cartão de Crédito
        elif payload.payment_method == "credit_card":
            if not payload.card_token:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="O campo 'card_token' é obrigatório para pagamento via cartão de crédito.",
                )

            card_input = CreateCreditCardCheckoutInput(
                external_reference=external_reference,
                total_amount=Decimal(str(amount_brl)),
                card_token=payload.card_token,
                payment_method_id=PaymentMethodId.VISA,
                installments=1,
                customer=customer,
                items=[item],
            )
            result = await self.checkout_service.create_credit_card_payment(
                tenant_id=tenant_id, input_data=card_input
            )

            # Se aprovado imediatamente (PROCESSED), adiciona os créditos ao saldo da carteira do tenant
            if result.status == OrderStatus.PROCESSED:
                await self.credit_service.add_credits(
                    tenant_id=tenant_id,
                    amount=payload.credits_package,
                    description=f"Recarga de {payload.credits_package} créditos (Cartão)",
                    external_payment_id=result.mp_order_id or result.order_id,
                )

            status_str = result.status.value if isinstance(result.status, OrderStatus) else str(result.status)
            return RechargeResponse(
                payment_id=result.mp_order_id or result.order_id,
                status=status_str,
                pix_qr_code=None,
                pix_copia_e_cola=None,
                expiration_date=None,
            )

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Método de pagamento '{payload.payment_method}' não suportado.",
            )
