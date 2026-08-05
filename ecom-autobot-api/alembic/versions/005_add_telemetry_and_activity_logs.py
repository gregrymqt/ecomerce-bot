"""Add telemetry and activity logs tables

Revision ID: 005_add_telemetry_and_activity_logs
Revises: 004_add_openrouter_provider
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '005_add_telemetry_and_activity_logs'
down_revision: Union[str, None] = '004_add_openrouter_provider'
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    # 1. Tabela robot_activities
    op.create_table(
        'robot_activities',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=100), nullable=False),
        sa.Column('worker_type', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_robot_activities_tenant_id'), 'robot_activities', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_robot_activities_worker_type'), 'robot_activities', ['worker_type'], unique=False)
    op.create_index(op.f('ix_robot_activities_status'), 'robot_activities', ['status'], unique=False)
    op.create_index(op.f('ix_robot_activities_created_at'), 'robot_activities', ['created_at'], unique=False)
    op.create_index(
        'ix_robot_activities_tenant_created',
        'robot_activities',
        ['tenant_id', 'created_at'],
        unique=False
    )
    op.create_index(
        'ix_robot_activities_tenant_status',
        'robot_activities',
        ['tenant_id', 'status'],
        unique=False
    )

    # 2. Tabela token_telemetry
    op.create_table(
        'token_telemetry',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=100), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('prompt_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('completion_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_token_telemetry_tenant_id'), 'token_telemetry', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_token_telemetry_provider'), 'token_telemetry', ['provider'], unique=False)
    op.create_index(op.f('ix_token_telemetry_created_at'), 'token_telemetry', ['created_at'], unique=False)
    op.create_index(
        'ix_token_telemetry_tenant_provider',
        'token_telemetry',
        ['tenant_id', 'provider'],
        unique=False
    )
    op.create_index(
        'ix_token_telemetry_tenant_created',
        'token_telemetry',
        ['tenant_id', 'created_at'],
        unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_token_telemetry_tenant_created', table_name='token_telemetry')
    op.drop_index('ix_token_telemetry_tenant_provider', table_name='token_telemetry')
    op.drop_index(op.f('ix_token_telemetry_created_at'), table_name='token_telemetry')
    op.drop_index(op.f('ix_token_telemetry_provider'), table_name='token_telemetry')
    op.drop_index(op.f('ix_token_telemetry_tenant_id'), table_name='token_telemetry')
    op.drop_table('token_telemetry')

    op.drop_index('ix_robot_activities_tenant_status', table_name='robot_activities')
    op.drop_index('ix_robot_activities_tenant_created', table_name='robot_activities')
    op.drop_index(op.f('ix_robot_activities_created_at'), table_name='robot_activities')
    op.drop_index(op.f('ix_robot_activities_status'), table_name='robot_activities')
    op.drop_index(op.f('ix_robot_activities_worker_type'), table_name='robot_activities')
    op.drop_index(op.f('ix_robot_activities_tenant_id'), table_name='robot_activities')
    op.drop_table('robot_activities')
