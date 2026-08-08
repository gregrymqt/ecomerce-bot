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

    async def atomic_deduct_credits(self, tenant_id: str, cost: Decimal) -> bool:
        """Executa um decremento SQL atômico no saldo de créditos do tenant se houver saldo suficiente."""
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
