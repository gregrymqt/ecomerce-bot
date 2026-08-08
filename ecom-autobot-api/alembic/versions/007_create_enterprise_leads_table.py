"""Create enterprise_leads table and add is_google_user to users table

Revision ID: 007_create_enterprise_leads
Revises: 006_add_tenant_settings_fields
Create Date: 2026-08-08 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '007_create_enterprise_leads'
down_revision: Union[str, None] = '006_add_tenant_settings_fields'
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    # 1. Coluna is_google_user na tabela users
    op.add_column(
        'users',
        sa.Column('is_google_user', sa.Boolean(), server_default='false', nullable=True)
    )

    # 2. Tabela enterprise_leads
    op.create_table(
        'enterprise_leads',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('company_name', sa.String(length=255), nullable=False),
        sa.Column('team_size', sa.String(length=50), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.Column('ip_address', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_enterprise_leads_email'), 'enterprise_leads', ['email'], unique=False)
    op.create_index(op.f('ix_enterprise_leads_created_at'), 'enterprise_leads', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_enterprise_leads_created_at'), table_name='enterprise_leads')
    op.drop_index(op.f('ix_enterprise_leads_email'), table_name='enterprise_leads')
    op.drop_table('enterprise_leads')
    op.drop_column('users', 'is_google_user')

