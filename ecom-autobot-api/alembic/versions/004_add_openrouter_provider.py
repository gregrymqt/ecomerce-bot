"""Add OPENROUTER to AI provider enum

Revision ID: 004_add_openrouter_provider
Revises: 003_enable_rls_and_tenant_security
Create Date: 2026-08-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '004_add_openrouter_provider'
down_revision: Union[str, None] = '003_enable_rls_tenant_sec'
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    # 1. Atualizar o tipo ENUM PostgreSQL para permitir 'OPENROUTER' se existir no banco
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'aiprovider') THEN
                ALTER TYPE aiprovider ADD VALUE IF NOT EXISTS 'OPENROUTER';
            END IF;
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_provider_enum') THEN
                ALTER TYPE ai_provider_enum ADD VALUE IF NOT EXISTS 'OPENROUTER';
            END IF;
        END$$;
    """)


def downgrade() -> None:
    # Nota: Em PostgreSQL, remover valores de um tipo ENUM não é diretamente suportado via ALTER TYPE.
    pass
