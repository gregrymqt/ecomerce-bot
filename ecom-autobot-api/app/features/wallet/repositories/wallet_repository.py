import logging
from typing import Any, List, Optional, Tuple

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.database import get_db
from app.features.wallet.domain.models import (
    CreditTransactionModel,
    TransactionType,
    WalletModel,
)
from app.features.wallet.exceptions import InsufficientBalanceException

logger = logging.getLogger(__name__)


class WalletRepository:
    """
    Repositório de dados para a carteira pré-paga e extrato de transações.
    Garante isolamento estrito por Tenant (WHERE tenant_id = :tenant_id) em todas as consultas e atualizações.
    """

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        self.session = session

    async def _get_session(self) -> Tuple[AsyncSession, bool]:
        if self.session is not None:
            return self.session, False
        gen = get_db()
        session = await anext(gen)
        return session, True

    async def get_or_create_wallet(self, tenant_id: str) -> WalletModel:
        """
        Busca a carteira do tenant pelo tenant_id.
        Se não existir, cria uma nova carteira com balance_credits = 0 e persiste no banco.
        """
        session, owned = await self._get_session()
        try:
            stmt = select(WalletModel).where(WalletModel.tenant_id == tenant_id)
            result = await session.execute(stmt)
            wallet = result.scalars().first()

            if not wallet:
                logger.info(f"[WalletRepository] Criando nova carteira pré-paga para o tenant '{tenant_id}'.")
                wallet = WalletModel(tenant_id=tenant_id, balance_credits=0)
                session.add(wallet)
                await session.flush()
                await session.commit()

            return wallet
        except Exception:
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()

    async def get_balance(self, tenant_id: str) -> int:
        """
        Retorna diretamente o saldo atual (balance_credits) do tenant.
        Se a carteira ainda não existir, cria uma nova com saldo 0.
        """
        session, owned = await self._get_session()
        try:
            stmt = select(WalletModel.balance_credits).where(WalletModel.tenant_id == tenant_id)
            result = await session.execute(stmt)
            balance = result.scalar_one_or_none()

            if balance is None:
                wallet = await self.get_or_create_wallet(tenant_id)
                return wallet.balance_credits

            return balance
        finally:
            if owned:
                await session.close()

    async def update_balance_atomic(self, tenant_id: str, amount: int) -> WalletModel:
        """
        Atualiza o saldo da carteira de forma atômica direto no banco via instrução UPDATE SQL:
        UPDATE wallets SET balance_credits = balance_credits + :amount, updated_at = now()
        WHERE tenant_id = :tenant_id AND (balance_credits + :amount) >= 0

        Lança InsufficientBalanceException caso o saldo fique negativo.
        """
        session, owned = await self._get_session()
        try:
            # Garante que a carteira existe antes da atualização
            wallet = await self.get_or_create_wallet(tenant_id)

            if wallet.balance_credits + amount < 0:
                raise InsufficientBalanceException(
                    f"Saldo insuficiente ({wallet.balance_credits} créditos) para debitar {abs(amount)} créditos no tenant '{tenant_id}'."
                )

            stmt = (
                update(WalletModel)
                .where(
                    WalletModel.tenant_id == tenant_id,
                    (WalletModel.balance_credits + amount) >= 0,
                )
                .values(
                    balance_credits=WalletModel.balance_credits + amount,
                    updated_at=func.now(),
                )
                .execution_options(synchronize_session="fetch")
            )
            result = await session.execute(stmt)

            if result.rowcount == 0:
                current_balance = await self.get_balance(tenant_id)
                if current_balance + amount < 0:
                    raise InsufficientBalanceException(
                        f"Saldo insuficiente ({current_balance} créditos) para debitar {abs(amount)} créditos no tenant '{tenant_id}'."
                    )

            await session.flush()
            if owned:
                await session.commit()
            return await self.get_or_create_wallet(tenant_id)
        except Exception:
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()

    async def create_transaction(
        self,
        tenant_id: str,
        wallet_id: Any,
        amount: int,
        transaction_type: str,
        description: str,
        external_payment_id: Optional[str] = None,
    ) -> CreditTransactionModel:
        """
        Registra uma nova transação de crédito/consumo no histórico do tenant.
        """
        session, owned = await self._get_session()
        try:
            transaction = CreditTransactionModel(
                tenant_id=tenant_id,
                wallet_id=str(wallet_id),
                amount=amount,
                type=transaction_type,
                description=description,
                external_payment_id=external_payment_id,
            )
            session.add(transaction)
            await session.flush()
            if owned:
                await session.commit()
            return transaction
        except Exception:
            if owned:
                await session.rollback()
            raise
        finally:
            if owned:
                await session.close()

    async def get_statement(
        self, tenant_id: str, limit: int = 50, offset: int = 0
    ) -> Tuple[List[CreditTransactionModel], int]:
        """
        Retorna as transações do tenant ordenadas por created_at DESC com paginação e o total de registros.
        """
        session, owned = await self._get_session()
        try:
            stmt = (
                select(CreditTransactionModel)
                .where(CreditTransactionModel.tenant_id == tenant_id)
                .order_by(CreditTransactionModel.created_at.desc())
                .offset(offset)
                .limit(limit)
            )
            count_stmt = (
                select(func.count())
                .select_from(CreditTransactionModel)
                .where(CreditTransactionModel.tenant_id == tenant_id)
            )

            result = await session.execute(stmt)
            count_result = await session.execute(count_stmt)

            transactions = list(result.scalars().all())
            total_count = count_result.scalar_one()

            return transactions, total_count
        finally:
            if owned:
                await session.close()
