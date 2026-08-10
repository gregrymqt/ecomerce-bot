"""Create local plans table and cleanup deprecated structures

Revision ID: 010_create_local_plans
Revises: 009_refactor_wallet
Create Date: 2026-08-10 12:42:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '010_create_local_plans'
down_revision: Union[str, None] = '009_refactor_wallet'
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Cria a tabela 'plans' para gestão local de planos (PostgreSQL + Redis)
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

    # 2. Garante a remoção de tabelas legadas obsoletas se ainda existirem
    if 'subscriptions' in tables:
        op.drop_table('subscriptions')

    if 'ai_keys' in tables:
        op.drop_table('ai_keys')


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'plans' in tables:
        op.drop_table('plans')
