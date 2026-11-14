-- ==============================================================================
-- Script 018: Endurecimento Fail-Closed de Row-Level Security (RLS) (PostgreSQL 16)
-- E-commerce Bot SaaS
-- Remove o fallback inseguro (SESSION_CONTEXT IS NULL AND IsSuperAdmin IS NULL)
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS security;

-- Recria a função de predicado em modo estritamente Fail-Closed
CREATE OR REPLACE FUNCTION security.fn_TenantAccessPredicate(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        p_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID
        OR NULLIF(current_setting('app.is_super_admin', true), '') = '1'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
