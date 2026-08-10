"""Refactor wallet and drop subscriptions byok

Revision ID: 009_refactor_wallet
Revises: 008_create_llm_usage_logs
Create Date: 2026-08-10 11:17:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '009_refactor_wallet'
down_revision: Union[str, None] = '008_create_llm_usage_logs'
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Cria tabela wallets
    if 'wallets' not in tables:
        op.create_table(
            'wallets',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('tenant_id', sa.String(length=64), nullable=False),
            sa.Column('balance_credits', sa.Integer(), server_default='0', nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.CheckConstraint('balance_credits >= 0', name='check_balance_credits_non_negative')
        )
        op.create_index(op.f('ix_wallets_tenant_id'), 'wallets', ['tenant_id'], unique=False)

    # 2. Cria tabela credit_transactions
    if 'credit_transactions' not in tables:
        op.create_table(
            'credit_transactions',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('tenant_id', sa.String(length=64), nullable=False),
            sa.Column('wallet_id', sa.String(length=36), nullable=False),
            sa.Column('amount', sa.Integer(), nullable=False),
            sa.Column('type', sa.String(length=20), nullable=False),
            sa.Column('description', sa.String(length=255), nullable=True),
            sa.Column('external_payment_id', sa.String(length=100), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['wallet_id'], ['wallets.id'], ondelete='CASCADE')
        )
        op.create_index(op.f('ix_credit_transactions_tenant_id'), 'credit_transactions', ['tenant_id'], unique=False)
        op.create_index(op.f('ix_credit_transactions_wallet_id'), 'credit_transactions', ['wallet_id'], unique=False)
        op.create_index(op.f('ix_credit_transactions_external_payment_id'), 'credit_transactions', ['external_payment_id'], unique=False)

    # 3. Remove tabelas legadas se existirem
    if 'subscriptions' in tables:
        op.drop_table('subscriptions')

    if 'plans' in tables:
        op.drop_table('plans')

    if 'ai_keys' in tables:
        op.drop_table('ai_keys')


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Remove credit_transactions se existir
    if 'credit_transactions' in tables:
        op.drop_index(op.f('ix_credit_transactions_external_payment_id'), table_name='credit_transactions')
        op.drop_index(op.f('ix_credit_transactions_wallet_id'), table_name='credit_transactions')
        op.drop_index(op.f('ix_credit_transactions_tenant_id'), table_name='credit_transactions')
        op.drop_table('credit_transactions')

    # 2. Remove wallets se existir
    if 'wallets' in tables:
        op.drop_index(op.f('ix_wallets_tenant_id'), table_name='wallets')
        op.drop_table('wallets')

    # 3. Recria plans e subscriptions se não existirem
    if 'plans' not in tables:
        op.create_table(
            'plans',
            sa.Column('id', sa.String(length=64), nullable=False),
            sa.Column('external_id', sa.String(length=64), nullable=True),
            sa.Column('reason', sa.String(length=255), nullable=False),
            sa.Column('status', sa.String(length=32), nullable=False, server_default='active'),
            sa.Column('auto_recurring', sa.JSON(), nullable=False),
            sa.Column('back_url', sa.String(length=500), nullable=True),
            sa.Column('collector_id', sa.Integer(), nullable=True),
            sa.Column('application_id', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('external_id')
        )

    if 'subscriptions' not in tables:
        op.create_table(
            'subscriptions',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('tenant_id', sa.String(length=100), nullable=False),
            sa.Column('plan_id', sa.String(length=36), sa.ForeignKey('plans.id', ondelete='SET NULL'), nullable=True),
            sa.Column('preapproval_id', sa.String(length=100), nullable=False),
            sa.Column('payer_email', sa.String(length=255), nullable=False),
            sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),
            sa.Column('reason', sa.String(length=255), nullable=True),
            sa.Column('external_reference', sa.String(length=255), nullable=True),
            sa.Column('init_point', sa.String(length=500), nullable=True),
            sa.Column('payment_method_id', sa.String(length=50), nullable=True),
            sa.Column('card_id', sa.String(length=100), nullable=True),
            sa.Column('auto_recurring', sa.JSON(), nullable=True),
            sa.Column('next_payment_date', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('preapproval_id')
        )
        op.create_index('ix_subscriptions_tenant_status', 'subscriptions', ['tenant_id', 'status'])
        op.create_index('ix_subscriptions_tenant_payer', 'subscriptions', ['tenant_id', 'payer_email'])
        op.create_index('ix_subscriptions_tenant_preapproval', 'subscriptions', ['tenant_id', 'preapproval_id'])
