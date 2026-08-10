from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.features.auth.schemas import AuthenticatedUser
from app.features.wallet.dependencies import require_wallet_balance
from app.features.wallet.services import CreditService


@pytest.mark.asyncio
async def test_require_wallet_balance_sufficient_credits() -> None:
    credit_service = AsyncMock(spec=CreditService)
    credit_service.check_balance.return_value = 5

    user = AuthenticatedUser(
        sub="usr_123",
        email="test@example.com",
        name="Test User",
        tenants=["tenant_qa"],
        plan="pro",
        is_admin=False,
        role="user",
    )

    gatekeeper_dep = require_wallet_balance(min_credits=1)
    res_user = await gatekeeper_dep(
        x_tenant_id="tenant_qa",
        current_user=user,
        credit_service=credit_service,
    )

    assert res_user == user
    credit_service.check_balance.assert_awaited_once_with("tenant_qa")


@pytest.mark.asyncio
async def test_require_wallet_balance_insufficient_credits_raises_402() -> None:
    credit_service = AsyncMock(spec=CreditService)
    credit_service.check_balance.return_value = 0

    user = AuthenticatedUser(
        sub="usr_123",
        email="test@example.com",
        name="Test User",
        tenants=["tenant_qa"],
        plan="free",
        is_admin=False,
        role="user",
    )

    gatekeeper_dep = require_wallet_balance(min_credits=1)

    with pytest.raises(HTTPException) as exc_info:
        await gatekeeper_dep(
            x_tenant_id="tenant_qa",
            current_user=user,
            credit_service=credit_service,
        )

    assert exc_info.value.status_code == 402
    assert exc_info.value.detail == "Saldo de créditos insuficiente. Realize uma recarga para continuar utilizando o robô."
    credit_service.check_balance.assert_awaited_once_with("tenant_qa")


@pytest.mark.asyncio
async def test_require_wallet_balance_custom_min_credits() -> None:
    credit_service = AsyncMock(spec=CreditService)
    credit_service.check_balance.return_value = 3

    user = AuthenticatedUser(
        sub="usr_123",
        email="test@example.com",
        name="Test User",
        tenants=["tenant_qa"],
        plan="pro",
        is_admin=False,
        role="user",
    )

    gatekeeper_dep = require_wallet_balance(min_credits=5)

    with pytest.raises(HTTPException) as exc_info:
        await gatekeeper_dep(
            x_tenant_id="tenant_qa",
            current_user=user,
            credit_service=credit_service,
        )

    assert exc_info.value.status_code == 402
    assert exc_info.value.detail == "Saldo de créditos insuficiente. Realize uma recarga para continuar utilizando o robô."
    credit_service.check_balance.assert_awaited_once_with("tenant_qa")
