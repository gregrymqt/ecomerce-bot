from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.ai_enrichment.domain.models import LLMUsageLogModel
from app.features.products.domain.models import TenantConfigModel


class LLMMeteringRepository:
    """Repositório de dados para persistência e consulta de metrificação de LLM e configurações de tenant."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_tenant_config(self, tenant_id: str) -> Optional[TenantConfigModel]:
        """Recupera as configurações e saldo do tenant pelo tenant_id."""
        stmt = select(TenantConfigModel).where(TenantConfigModel.tenant_id == tenant_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_managed_credit_balance(self, tenant_id: str) -> Optional[Decimal]:
        """Recupera o saldo atual de créditos gerenciados do tenant."""
        stmt = select(TenantConfigModel.managed_credit_balance).where(
            TenantConfigModel.tenant_id == tenant_id
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_usage_log(self, log_model: LLMUsageLogModel) -> LLMUsageLogModel:
        """Adiciona e persiste um novo registro de uso de LLM na sessão."""
        self.session.add(log_model)
        await self.session.flush()
        return log_model

    async def atomic_reserve_credits(self, tenant_id: str, estimated_cost: Decimal) -> bool:
        """
        Pré-reserva atômica de créditos usando SELECT FOR UPDATE SKIP LOCKED.

        Lógica:
          1. Bloqueia pessimisticamente a linha do tenant no PostgreSQL para leitura
             exclusiva (nenhuma outra transação pode ler ou alterar enquanto este
             SELECT FOR UPDATE estiver pendente).
          2. Verifica se o saldo atual suporta o custo estimado.
          3. Se sim, decrementa imediatamente e faz commit — bloqueando qualquer
             requisição concorrente que também tente reservar para o mesmo tenant.
          4. Retorna False (sem debitar) se o saldo for insuficiente.

        SKIP LOCKED garante que workers concorrentes não fiquem em deadlock:
        se a linha já está bloqueada, a instrução retorna sem linhas (rowcount=0)
        e o chamador pode rejeitar a requisição por falta de créditos.
        """
        from sqlalchemy import text

        # Busca e bloqueia a linha atomicamente
        lock_stmt = text(
            "SELECT managed_credit_balance FROM tenant_configs "
            "WHERE tenant_id = :tenant_id FOR UPDATE SKIP LOCKED"
        )
        result = await self.session.execute(lock_stmt, {"tenant_id": tenant_id})
        row = result.fetchone()

        if row is None:
            # Linha bloqueada por outro worker ou tenant não existe — nega a reserva
            return False

        current_balance = Decimal(str(row[0])) if row[0] is not None else Decimal("0.000000")
        if current_balance < estimated_cost:
            return False

        # Decremento atômico enquanto a linha ainda está bloqueada
        deduct_stmt = (
            update(TenantConfigModel)
            .where(TenantConfigModel.tenant_id == tenant_id)
            .values(
                managed_credit_balance=TenantConfigModel.managed_credit_balance - estimated_cost
            )
        )
        await self.session.execute(deduct_stmt)
        return True

    async def atomic_refund_credits(self, tenant_id: str, amount: Decimal) -> None:
        """
        Estorna (reverte) créditos reservados em caso de falha do provedor de LLM.

        Deve ser chamado no bloco `except` do ProcessorWorker quando a chamada
        ao OpenRouter falha por erro de infraestrutura ou timeout após a reserva
        ter sido confirmada pelo `atomic_reserve_credits`.
        """
        refund_stmt = (
            update(TenantConfigModel)
            .where(TenantConfigModel.tenant_id == tenant_id)
            .values(
                managed_credit_balance=TenantConfigModel.managed_credit_balance + amount
            )
        )
        await self.session.execute(refund_stmt)

    async def atomic_settle_credits(
        self, tenant_id: str, reserved_cost: Decimal, actual_cost: Decimal
    ) -> None:
        """
        Ajusta o saldo após a execução real da LLM, compensando a diferença entre
        o custo estimado na reserva e o custo real consumido.

        - Se `actual_cost < reserved_cost`: devolve a diferença (estorno parcial).
        - Se `actual_cost > reserved_cost`: cobra a diferença adicional atomicamente.
        """
        delta = reserved_cost - actual_cost  # positivo = estorno, negativo = débito extra
        if delta == Decimal("0.000000"):
            return

        settle_stmt = (
            update(TenantConfigModel)
            .where(TenantConfigModel.tenant_id == tenant_id)
            .values(
                managed_credit_balance=TenantConfigModel.managed_credit_balance + delta
            )
        )
        await self.session.execute(settle_stmt)

    async def atomic_deduct_credits(self, tenant_id: str, cost: Decimal) -> bool:
        """
        Decremento SQL atômico legado (sem SELECT FOR UPDATE).

        Mantido para compatibilidade com fluxos não-concorrentes (ex: modo demo,
        exportação CSV). Para fluxos de LLM concorrentes, prefira o par
        `atomic_reserve_credits` + `atomic_settle_credits` / `atomic_refund_credits`.
        """

        stmt = (
            update(TenantConfigModel)
            .where(
                TenantConfigModel.tenant_id == tenant_id,
                TenantConfigModel.managed_credit_balance >= cost,
            )
            .values(
                managed_credit_balance=TenantConfigModel.managed_credit_balance - cost
            )
        )
        res = await self.session.execute(stmt)
        return res.rowcount > 0

    async def get_monthly_telemetry(self, tenant_id: str) -> Tuple[int, Decimal]:
        """Calcula o total acumulado de tokens e custos em USD do mês corrente para o tenant."""
        first_day_of_month = func.date_trunc("month", func.now())
        monthly_stmt = select(
            func.coalesce(func.sum(LLMUsageLogModel.total_tokens), 0),
            func.coalesce(func.sum(LLMUsageLogModel.estimated_cost_usd), 0),
        ).where(
            LLMUsageLogModel.tenant_id == tenant_id,
            LLMUsageLogModel.created_at >= first_day_of_month,
        )
        monthly_res = await self.session.execute(monthly_stmt)
        row = monthly_res.one()
        return int(row[0]), Decimal(str(row[1]))

    async def get_usage_logs_paginated(
        self,
        tenant_id: str,
        page: int = 1,
        limit: int = 20,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Tuple[List[LLMUsageLogModel], int]:
        """Retorna os logs de uso do tenant com ordenação por data decrescente e contagem total."""
        base_query = select(LLMUsageLogModel).where(LLMUsageLogModel.tenant_id == tenant_id)

        if start_date:
            base_query = base_query.where(LLMUsageLogModel.created_at >= start_date)
        if end_date:
            base_query = base_query.where(LLMUsageLogModel.created_at <= end_date)

        # Contagem total de registros correspondentes
        count_query = select(func.count()).select_from(base_query.subquery())
        total_res = await self.session.execute(count_query)
        total_items = total_res.scalar() or 0

        # Busca com paginação
        offset_val = (page - 1) * limit
        paginated_query = (
            base_query.order_by(LLMUsageLogModel.created_at.desc())
            .offset(offset_val)
            .limit(limit)
        )

        result = await self.session.execute(paginated_query)
        logs = list(result.scalars().all())

        return logs, total_items
