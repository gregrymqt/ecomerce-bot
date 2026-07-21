"""Initial schema ecommerce_bot

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-07-21 15:57:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    # 1. Tabela products
    op.create_table(
        'products',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=100), nullable=False),
        sa.Column('sku', sa.String(length=100), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='Raw'),
        sa.Column('raw_payload', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('ai_enriched_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_products_tenant_id'), 'products', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_products_sku'), 'products', ['sku'], unique=False)
    op.create_index(op.f('ix_products_status'), 'products', ['status'], unique=False)

    # 2. Tabela tenant_configs (BYOK)
    op.create_table(
        'tenant_configs',
        sa.Column('tenant_id', sa.String(length=100), nullable=False),
        sa.Column('encrypted_keys', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('tenant_id')
    )

    # 3. Tabela demo_rate_limits
    op.create_table(
        'demo_rate_limits',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('ip', sa.String(length=64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_demo_rate_limits_ip'), 'demo_rate_limits', ['ip'], unique=False)

    # 4. Tabela scraping_metadata
    op.create_table(
        'scraping_metadata',
        sa.Column('domain', sa.String(length=255), nullable=False),
        sa.Column('consecutive_failures', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('silenced_until', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('domain')
    )


def downgrade() -> None:
    op.drop_table('scraping_metadata')
    op.drop_index(op.f('ix_demo_rate_limits_ip'), table_name='demo_rate_limits')
    op.drop_table('demo_rate_limits')
    op.drop_table('tenant_configs')
    op.drop_index(op.f('ix_products_status'), table_name='products')
    op.drop_index(op.f('ix_products_sku'), table_name='products')
    op.drop_index(op.f('ix_products_tenant_id'), table_name='products')
    op.drop_table('products')
