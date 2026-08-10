import logging
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import get_db
from app.core.security.auth import get_current_tenant_user, sanitize_tenant_id
from app.features.auth.schemas import AuthenticatedUser
from app.features.wallet.repositories import WalletRepository
from app.features.wallet.services import CreditService

logger = logging.getLogger(__name__)


def get_credit_service(db: AsyncSession = Depends(get_db)) -> CreditService:
    """
    Injetor de dependência FastAPI para instanciação do CreditService.
    """
    repository = WalletRepository(session=db)
    return CreditService(repository=repository)


def require_wallet_balance(min_credits: int = 1):
    """
    Dependência FastAPI (Gatekeeper) para validação de saldo mínimo de créditos na carteira do Tenant.

    - Extrai o tenant_id do contexto da requisição (header X-Tenant-ID / get_current_tenant_user).
    - Executa a verificação de saldo via CreditService.
    - Se current_balance < min_credits, dispara HTTPException HTTP 402 Payment Required.
    """

    async def _check_wallet_balance(
        x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
        current_user: AuthenticatedUser = Depends(get_current_tenant_user),
        credit_service: CreditService = Depends(get_credit_service),
    ) -> AuthenticatedUser:
        tenant_id = sanitize_tenant_id(x_tenant_id)
        current_balance = await credit_service.check_balance(tenant_id)

        if current_balance < min_credits:
            logger.warning(
                f"[WalletGatekeeper] Saldo insuficiente no tenant '{tenant_id}': "
                f"requerido={min_credits}, atual={current_balance}."
            )
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Saldo de créditos insuficiente. Realize uma recarga para continuar utilizando o robô.",
            )

        return current_user

    return _check_wallet_balance
