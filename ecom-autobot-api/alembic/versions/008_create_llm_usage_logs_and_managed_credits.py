"""Create llm_usage_logs table and add managed_credit_balance to tenant_configs

Revision ID: 008_create_llm_usage_logs
Revises: 007_create_enterprise_leads
Create Date: 2026-08-08 21:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '008_create_llm_usage_logs'
down_revision: Union[str, None] = '007_create_enterprise_leads'
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    # 1. Adiciona coluna managed_credit_balance na tabela tenant_configs
    op.add_column(
        'tenant_configs',
        sa.Column(
            'managed_credit_balance',
            sa.Numeric(precision=10, scale=6),
            server_default='0.000000',
            nullable=False
        )
    )

    # 2. Cria tabela llm_usage_logs
    op.create_table(
        'llm_usage_logs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=100), nullable=False),
        sa.Column('product_id', sa.String(length=36), nullable=True),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('model_used', sa.String(length=100), nullable=False),
        sa.Column('prompt_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('completion_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('total_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('estimated_cost_usd', sa.Numeric(precision=10, scale=6), server_default='0.000000', nullable=False),
        sa.Column('is_byok', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('execution_time_ms', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # 3. Cria índices individuais
    op.create_index(op.f('ix_llm_usage_logs_tenant_id'), 'llm_usage_logs', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_llm_usage_logs_product_id'), 'llm_usage_logs', ['product_id'], unique=False)
    op.create_index(op.f('ix_llm_usage_logs_provider'), 'llm_usage_logs', ['provider'], unique=False)
    op.create_index(op.f('ix_llm_usage_logs_model_used'), 'llm_usage_logs', ['model_used'], unique=False)
    op.create_index(op.f('ix_llm_usage_logs_is_byok'), 'llm_usage_logs', ['is_byok'], unique=False)
    op.create_index(op.f('ix_llm_usage_logs_created_at'), 'llm_usage_logs', ['created_at'], unique=False)

    # 4. Cria índices compostos
    op.create_index('ix_llm_usage_logs_tenant_created', 'llm_usage_logs', ['tenant_id', 'created_at'], unique=False)
    op.create_index('ix_llm_usage_logs_tenant_byok', 'llm_usage_logs', ['tenant_id', 'is_byok'], unique=False)


def downgrade() -> None:
    # Remove índices compostos e individuais da tabela llm_usage_logs
    op.drop_index('ix_llm_usage_logs_tenant_byok', table_name='llm_usage_logs')
    op.drop_index('ix_llm_usage_logs_tenant_created', table_name='llm_usage_logs')
    op.drop_index(op.f('ix_llm_usage_logs_created_at'), table_name='llm_usage_logs')
    op.drop_index(op.f('ix_llm_usage_logs_is_byok'), table_name='llm_usage_logs')
    op.drop_index(op.f('ix_llm_usage_logs_model_used'), table_name='llm_usage_logs')
    op.drop_index(op.f('ix_llm_usage_logs_provider'), table_name='llm_usage_logs')
    op.drop_index(op.f('ix_llm_usage_logs_product_id'), table_name='llm_usage_logs')
    op.drop_index(op.f('ix_llm_usage_logs_tenant_id'), table_name='llm_usage_logs')

    # Remove tabela llm_usage_logs
    op.drop_table('llm_usage_logs')

    # Remove coluna managed_credit_balance da tabela tenant_configs
    op.drop_column('tenant_configs', 'managed_credit_balance')
