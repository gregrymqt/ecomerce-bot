-- ==============================================================================
-- Script 019: Normalização de Role legado 'OWNER' para 'TENANT_ADMIN' (PostgreSQL 16)
-- Idempotente: pode ser reexecutado com segurança via DbUp.
-- ==============================================================================

DO $$
DECLARE
    v_tenant_admin_role_id UUID;
BEGIN
    SELECT Id INTO v_tenant_admin_role_id 
    FROM dbo.Roles 
    WHERE Name = 'TENANT_ADMIN' 
    LIMIT 1;

    IF v_tenant_admin_role_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM dbo.Users WHERE UPPER(Role) = 'OWNER'
    ) THEN
        UPDATE dbo.Users
        SET Role = 'TENANT_ADMIN',
            RoleId = v_tenant_admin_role_id,
            UpdatedAt = NOW()
        WHERE UPPER(Role) = 'OWNER';
    END IF;
END $$;
