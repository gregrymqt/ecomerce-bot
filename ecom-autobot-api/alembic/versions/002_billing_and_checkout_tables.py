"""Add billing and checkout tables

Revision ID: 002_billing_and_checkout
Revises: 001_initial_schema
Create Date: 2026-07-24 21:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '002_billing_and_checkout'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    # 1. Tabela plans
    op.create_table(
        'plans',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('external_id', sa.String(length=64), nullable=True),
        sa.Column('reason', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='active'),
        sa.Column('auto_recurring', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('back_url', sa.String(length=500), nullable=True),
        sa.Column('collector_id', sa.Integer(), nullable=True),
        sa.Column('application_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('external_id')
    )

    # 2. Tabela subscriptions
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
        sa.Column('auto_recurring', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('next_payment_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('preapproval_id')
    )
    op.create_index('ix_subscriptions_tenant_status', 'subscriptions', ['tenant_id', 'status'])
    op.create_index('ix_subscriptions_tenant_payer', 'subscriptions', ['tenant_id', 'payer_email'])
    op.create_index('ix_subscriptions_tenant_preapproval', 'subscriptions', ['tenant_id', 'preapproval_id'])

    # 3. Tabela checkout_orders
    op.create_table(
        'checkout_orders',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('mp_order_id', sa.String(length=64), nullable=True),
        sa.Column('external_reference', sa.String(length=150), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('status_detail', sa.String(length=50), nullable=True),
        sa.Column('payment_method_type', sa.String(length=50), nullable=False),
        sa.Column('total_amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('total_paid_amount', sa.Numeric(precision=10, scale=2), server_default='0.00'),
        sa.Column('payer_email', sa.String(length=255), nullable=False),
        sa.Column('payer_document_type', sa.String(length=20), nullable=True),
        sa.Column('payer_document_number', sa.String(length=30), nullable=True),
        sa.Column('ticket_url', sa.Text(), nullable=True),
        sa.Column('pix_qr_code', sa.Text(), nullable=True),
        sa.Column('pix_qr_code_base64', sa.Text(), nullable=True),
        sa.Column('pix_expiration_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('raw_mp_response', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_orders_tenant_ext_ref', 'checkout_orders', ['tenant_id', 'external_reference'], unique=True)
    op.create_index('idx_orders_tenant_mp_id', 'checkout_orders', ['tenant_id', 'mp_order_id'])

    # 4. Tabela checkout_order_items
    op.create_table(
        'checkout_order_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('order_id', sa.String(length=64), sa.ForeignKey('checkout_orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('unit_price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('external_code', sa.String(length=100), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('checkout_order_items')
    op.drop_index('idx_orders_tenant_mp_id', table_name='checkout_orders')
    op.drop_index('idx_orders_tenant_ext_ref', table_name='checkout_orders')
    op.drop_table('checkout_orders')
    op.drop_index('ix_subscriptions_tenant_preapproval', table_name='subscriptions')
    op.drop_index('ix_subscriptions_tenant_payer', table_name='subscriptions')
    op.drop_index('ix_subscriptions_tenant_status', table_name='subscriptions')
    op.drop_table('subscriptions')
    op.drop_table('plans')
