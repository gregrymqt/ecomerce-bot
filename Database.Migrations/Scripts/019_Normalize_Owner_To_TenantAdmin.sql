-- ==============================================================================
-- Script 019: Normalização de Role legado 'OWNER' para 'TENANT_ADMIN' (LOG-04)
-- Idempotente: pode ser reexecutado com segurança via DbUp.
-- ==============================================================================

DECLARE @TenantAdminRoleId UNIQUEIDENTIFIER = (
    SELECT TOP 1 Id FROM dbo.Roles WHERE Name = 'TENANT_ADMIN'
);

IF @TenantAdminRoleId IS NOT NULL AND EXISTS (
    SELECT 1 FROM dbo.Users WHERE UPPER(Role) = 'OWNER'
)
BEGIN
    UPDATE dbo.Users
    SET Role = 'TENANT_ADMIN',
        RoleId = @TenantAdminRoleId,
        UpdatedAt = SYSDATETIMEOFFSET()
    WHERE UPPER(Role) = 'OWNER';
END
GO
