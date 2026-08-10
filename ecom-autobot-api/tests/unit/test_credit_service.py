from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.core.config.redis_db import RedisCache
from app.features.wallet.domain.models import CreditTransactionModel, WalletModel
from app.features.wallet.exceptions import InsufficientBalanceException
from app.features.wallet.repositories import WalletRepository
from app.features.wallet.schemas import WalletStatementResponse
from app.features.wallet.services.credit_service import CreditService


@pytest.mark.asyncio
async def test_check_balance_cache_hit() -> None:
    repo = AsyncMock(spec=WalletRepository)
    redis_mock = AsyncMock(spec=RedisCache)
    redis_mock.get.return_value = 150

    service = CreditService(repository=repo, redis_client=redis_mock)
    balance = await service.check_balance("tenant_qa")

    assert balance == 150
    redis_mock.get.assert_awaited_once_with("wallet:balance:tenant_qa")
    repo.get_balance.assert_not_called()


@pytest.mark.asyncio
async def test_check_balance_cache_miss() -> None:
    repo = AsyncMock(spec=WalletRepository)
    repo.get_balance.return_value = 250

    redis_mock = AsyncMock(spec=RedisCache)
    redis_mock.get.return_value = None

    service = CreditService(repository=repo, redis_client=redis_mock)
    balance = await service.check_balance("tenant_qa")

    assert balance == 250
    redis_mock.get.assert_awaited_once_with("wallet:balance:tenant_qa")
    repo.get_balance.assert_awaited_once_with("tenant_qa")
    redis_mock.set.assert_awaited_once_with("wallet:balance:tenant_qa", 250, expire_seconds=3600)


@pytest.mark.asyncio
async def test_add_credits_success() -> None:
    repo = AsyncMock(spec=WalletRepository)
    repo.session = AsyncMock()

    updated_wallet = WalletModel(id="w1", tenant_id="tenant_qa", balance_credits=500)
    repo.update_balance_atomic.return_value = updated_wallet

    redis_mock = AsyncMock(spec=RedisCache)
    service = CreditService(repository=repo, redis_client=redis_mock)

    res = await service.add_credits(
        tenant_id="tenant_qa",
        amount=500,
        description="Recarga de teste",
        external_payment_id="pay_123",
    )

    assert res.balance_credits == 500
    repo.get_or_create_wallet.assert_awaited_once_with("tenant_qa")
    repo.update_balance_atomic.assert_awaited_once_with("tenant_qa", 500)
    repo.create_transaction.assert_awaited_once_with(
        tenant_id="tenant_qa",
        wallet_id="w1",
        amount=500,
        transaction_type="RECHARGE",
        description="Recarga de teste",
        external_payment_id="pay_123",
    )
    repo.session.commit.assert_awaited_once()
    redis_mock.set.assert_awaited_once_with("wallet:balance:tenant_qa", 500, expire_seconds=3600)


@pytest.mark.asyncio
async def test_consume_credits_success() -> None:
    repo = AsyncMock(spec=WalletRepository)
    repo.session = AsyncMock()

    updated_wallet = WalletModel(id="w1", tenant_id="tenant_qa", balance_credits=9)
    repo.update_balance_atomic.return_value = updated_wallet

    redis_mock = AsyncMock(spec=RedisCache)
    service = CreditService(repository=repo, redis_client=redis_mock)

    success = await service.consume_credits(
        tenant_id="tenant_qa", amount=1, description="Consumo de enriquecimento"
    )

    assert success is True
    repo.update_balance_atomic.assert_awaited_once_with("tenant_qa", -1)
    repo.create_transaction.assert_awaited_once_with(
        tenant_id="tenant_qa",
        wallet_id="w1",
        amount=-1,
        transaction_type="USAGE",
        description="Consumo de enriquecimento",
    )
    repo.session.commit.assert_awaited_once()
    redis_mock.set.assert_awaited_once_with("wallet:balance:tenant_qa", 9, expire_seconds=3600)


@pytest.mark.asyncio
async def test_consume_credits_insufficient_balance_raises_402() -> None:
    repo = AsyncMock(spec=WalletRepository)
    repo.update_balance_atomic.side_effect = InsufficientBalanceException("Saldo insuficiente")

    redis_mock = AsyncMock(spec=RedisCache)
    service = CreditService(repository=repo, redis_client=redis_mock)

    with pytest.raises(HTTPException) as exc_info:
        await service.consume_credits(tenant_id="tenant_qa", amount=50)

    assert exc_info.value.status_code == 402
    assert "Saldo de créditos insuficiente" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_statement() -> None:
    repo = AsyncMock(spec=WalletRepository)
    now = datetime.now(timezone.utc)
    tx1 = CreditTransactionModel(
        id="t1",
        tenant_id="tenant_qa",
        amount=100,
        type="RECHARGE",
        description="Recarga PIX",
        created_at=now,
    )
    repo.get_statement.return_value = ([tx1], 1)
    repo.get_balance.return_value = 100

    redis_mock = AsyncMock(spec=RedisCache)
    redis_mock.get.return_value = 100

    service = CreditService(repository=repo, redis_client=redis_mock)
    statement = await service.get_statement(tenant_id="tenant_qa", page=1, page_size=20)

    assert isinstance(statement, WalletStatementResponse)
    assert statement.balance_credits == 100
    assert statement.total_count == 1
    assert len(statement.transactions) == 1
    assert statement.transactions[0].id == "t1"
