import logging
from typing import Optional

from fastapi import HTTPException, status

from app.core.config.redis_db import RedisCache, redis_cache
from app.features.wallet.domain.models import WalletModel
from app.features.wallet.exceptions import InsufficientBalanceException
from app.features.wallet.repositories import WalletRepository
from app.features.wallet.schemas import (
    CreditTransactionResponse,
    WalletStatementResponse,
)

logger = logging.getLogger(__name__)


class CreditService:
    """
    Serviço de negócio para gestão de créditos, transações e cache Redis da carteira pré-paga.
    """

    CACHE_TTL_SECONDS = 3600

    def __init__(
        self,
        repository: WalletRepository,
        redis_client: RedisCache = redis_cache,
    ) -> None:
        self.repository = repository
        self.redis_cache = redis_client

    @staticmethod
    def _cache_key(tenant_id: str) -> str:
        return f"wallet:balance:{tenant_id}"

    async def check_balance(self, tenant_id: str) -> int:
        """
        Consulta o saldo de créditos do tenant.
        Estratégia Cache-aside: tenta primeiro o Redis (wallet:balance:{tenant_id}).
        Em caso de cache miss, consulta a base de dados, atualiza o Redis e retorna.
        """
        key = self._cache_key(tenant_id)
        cached_val = await self.redis_cache.get(key)

        if cached_val is not None:
            try:
                return int(cached_val)
            except (ValueError, TypeError):
                logger.warning(f"[CreditService] Valor inválido no cache Redis para a chave {key}.")

        balance = await self.repository.get_balance(tenant_id)
        await self.redis_cache.set(key, balance, expire_seconds=self.CACHE_TTL_SECONDS)
        return balance

    async def add_credits(
        self,
        tenant_id: str,
        amount: int,
        description: str,
        external_payment_id: Optional[str] = None,
    ) -> WalletModel:
        """
        Inicia a transação no banco, incrementa os créditos atômicos,
        registra o extrato (RECHARGE) e atualiza o cache no Redis.
        """
        if amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O valor para recarga deve ser maior que zero.",
            )

        await self.repository.get_or_create_wallet(tenant_id)
        updated_wallet = await self.repository.update_balance_atomic(tenant_id, amount)
        await self.repository.create_transaction(
            tenant_id=tenant_id,
            wallet_id=updated_wallet.id,
            amount=amount,
            transaction_type="RECHARGE",
            description=description,
            external_payment_id=external_payment_id,
        )
        await self.repository.session.commit()

        key = self._cache_key(tenant_id)
        await self.redis_cache.set(key, updated_wallet.balance_credits, expire_seconds=self.CACHE_TTL_SECONDS)

        return updated_wallet

    async def consume_credits(
        self,
        tenant_id: str,
        amount: int = 1,
        description: str = "Consumo de extração/enriquecimento",
    ) -> bool:
        """
        Deduz atomicamente os créditos do tenant, registra o consumo no extrato (USAGE)
        e atualiza a chave no Redis.
        Caso o saldo seja insuficiente, dispara HTTP 402 Payment Required.
        """
        if amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A quantidade de créditos a consumir deve ser maior que zero.",
            )

        try:
            updated_wallet = await self.repository.update_balance_atomic(tenant_id, -amount)
            await self.repository.create_transaction(
                tenant_id=tenant_id,
                wallet_id=updated_wallet.id,
                amount=-amount,
                transaction_type="USAGE",
                description=description,
            )
            await self.repository.session.commit()

            key = self._cache_key(tenant_id)
            await self.redis_cache.set(key, updated_wallet.balance_credits, expire_seconds=self.CACHE_TTL_SECONDS)
            return True
        except InsufficientBalanceException as err:
            logger.warning(f"[CreditService] Saldo insuficiente para consumo no tenant '{tenant_id}': {err}")
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Saldo de créditos insuficiente. Por favor, recarregue sua carteira.",
            )

    async def get_statement(
        self, tenant_id: str, page: int = 1, page_size: int = 20
    ) -> WalletStatementResponse:
        """
        Busca o extrato de transações paginado e formata o resultado no schema Pydantic WalletStatementResponse.
        """
        safe_page = max(1, page)
        safe_size = max(1, min(100, page_size))
        offset = (safe_page - 1) * safe_size

        transactions, total_count = await self.repository.get_statement(
            tenant_id=tenant_id, limit=safe_size, offset=offset
        )
        balance = await self.check_balance(tenant_id)

        tx_responses = [
            CreditTransactionResponse.model_validate(t) for t in transactions
        ]

        return WalletStatementResponse(
            balance_credits=balance,
            transactions=tx_responses,
            total_count=total_count,
        )
