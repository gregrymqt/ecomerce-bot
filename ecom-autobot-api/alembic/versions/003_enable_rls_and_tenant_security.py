"""Enable Row Level Security (RLS) and Tenant Isolation Policies

Revision ID: 003_enable_rls_and_tenant_security
Revises: 002_billing_and_checkout
Create Date: 2026-07-31 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '003_enable_rls_tenant_sec'
down_revision: Union[str, None] = '002_billing_and_checkout'
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None

TENANT_TABLES = [
    'products',
    'tenant_configs',
    'subscriptions',
    'checkout_orders'
]

def upgrade() -> None:
    # 1. Habilita RLS e aplica regras de isolamento para tabelas baseadas em tenant_id
    for table in TENANT_TABLES:
        # Ativa Row Level Security
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")

        # Política: Garante acesso apenas quando tenant_id for igual à variável de sessão 'app.current_tenant'
        op.execute(f"""
            CREATE POLICY tenant_isolation_{table}_policy ON {table}
            FOR ALL
            USING (
                tenant_id = NULLIF(current_setting('app.current_tenant', true), '')
                OR current_setting('role', true) = 'postgres'
                OR current_setting('role', true) = 'service_role'
            )
            WITH CHECK (
                tenant_id = NULLIF(current_setting('app.current_tenant', true), '')
                OR current_setting('role', true) = 'postgres'
                OR current_setting('role', true) = 'service_role'
            );
        """)

    # 2. Política RLS Especial para checkout_order_items (Vinculado por FK à checkout_orders)
    op.execute("ALTER TABLE checkout_order_items ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE checkout_order_items FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY tenant_isolation_checkout_order_items_policy ON checkout_order_items
        FOR ALL
        USING (
            order_id IN (
                SELECT id FROM checkout_orders 
                WHERE tenant_id = NULLIF(current_setting('app.current_tenant', true), '')
            )
            OR current_setting('role', true) = 'postgres'
            OR current_setting('role', true) = 'service_role'
        );
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation_checkout_order_items_policy ON checkout_order_items;")
    op.execute("ALTER TABLE checkout_order_items DISABLE ROW LEVEL SECURITY;")

    for table in TENANT_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_{table}_policy ON {table};")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")