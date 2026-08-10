from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.wallet.domain.models import CreditTransactionModel, WalletModel
from app.features.wallet.exceptions import InsufficientBalanceException
from app.features.wallet.repositories.wallet_repository import WalletRepository


@pytest.mark.asyncio
async def test_get_or_create_wallet_existing() -> None:
    session = AsyncMock(spec=AsyncSession)
    existing_wallet = WalletModel(id="w1", tenant_id="tenant_qa", balance_credits=100)

    mock_result = MagicMock()
    mock_result.scalars().first.return_value = existing_wallet
    session.execute.return_value = mock_result

    repo = WalletRepository(session)
    wallet = await repo.get_or_create_wallet("tenant_qa")

    assert wallet.tenant_id == "tenant_qa"
    assert wallet.balance_credits == 100


@pytest.mark.asyncio
async def test_get_or_create_wallet_new() -> None:
    session = AsyncMock(spec=AsyncSession)

    mock_result = MagicMock()
    mock_result.scalars().first.return_value = None
    session.execute.return_value = mock_result

    repo = WalletRepository(session)
    wallet = await repo.get_or_create_wallet("tenant_new")

    assert wallet.tenant_id == "tenant_new"
    assert wallet.balance_credits == 0
    session.add.assert_called_once()
    session.flush.assert_awaited_once()
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_balance_existing() -> None:
    session = AsyncMock(spec=AsyncSession)

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = 50
    session.execute.return_value = mock_result

    repo = WalletRepository(session)
    balance = await repo.get_balance("tenant_qa")

    assert balance == 50


@pytest.mark.asyncio
async def test_update_balance_atomic_insufficient_balance_raises_exception() -> None:
    session = AsyncMock(spec=AsyncSession)
    wallet = WalletModel(id="w1", tenant_id="tenant_qa", balance_credits=10)

    mock_result = MagicMock()
    mock_result.scalars().first.return_value = wallet
    session.execute.return_value = mock_result

    repo = WalletRepository(session)

    with pytest.raises(InsufficientBalanceException) as exc_info:
        await repo.update_balance_atomic("tenant_qa", -20)

    assert "Saldo insuficiente" in str(exc_info.value)


@pytest.mark.asyncio
async def test_create_transaction() -> None:
    session = AsyncMock(spec=AsyncSession)
    repo = WalletRepository(session)

    tx = await repo.create_transaction(
        tenant_id="tenant_qa",
        wallet_id="w1",
        amount=100,
        transaction_type="RECHARGE",
        description="Recarga de 100 créditos",
        external_payment_id="mp_pay_123",
    )

    assert tx.tenant_id == "tenant_qa"
    assert tx.wallet_id == "w1"
    assert tx.amount == 100
    assert tx.type == "RECHARGE"
    assert tx.external_payment_id == "mp_pay_123"
    session.add.assert_called_once()
    session.flush.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_statement() -> None:
    session = AsyncMock(spec=AsyncSession)
    tx1 = CreditTransactionModel(id="t1", tenant_id="tenant_qa", amount=100, type="RECHARGE")
    tx2 = CreditTransactionModel(id="t2", tenant_id="tenant_qa", amount=-10, type="USAGE")

    mock_tx_result = MagicMock()
    mock_tx_result.scalars().all.return_value = [tx1, tx2]

    mock_count_result = MagicMock()
    mock_count_result.scalar_one.return_value = 2

    session.execute.side_effect = [mock_tx_result, mock_count_result]

    repo = WalletRepository(session)
    transactions, total = await repo.get_statement("tenant_qa", limit=10, offset=0)

    assert len(transactions) == 2
    assert total == 2
