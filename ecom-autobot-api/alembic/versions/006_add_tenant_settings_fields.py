"""Add tenant settings fields to tenant_configs table

Revision ID: 006_add_tenant_settings_fields
Revises: 005_add_telemetry_and_activity_logs
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '006_add_tenant_settings_fields'
down_revision: Union[str, None] = '005_add_telemetry_and_activity_logs'
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'tenant_configs',
        sa.Column('ai_settings', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False)
    )
    op.add_column(
        'tenant_configs',
        sa.Column('pricing_settings', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False)
    )
    op.add_column(
        'tenant_configs',
        sa.Column('store_profile', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False)
    )


def downgrade() -> None:
    op.drop_column('tenant_configs', 'store_profile')
    op.drop_column('tenant_configs', 'pricing_settings')
    op.drop_column('tenant_configs', 'ai_settings')
