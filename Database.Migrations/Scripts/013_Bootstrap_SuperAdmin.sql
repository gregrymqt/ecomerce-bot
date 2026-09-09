-- ==============================================================================
-- Script 013: Bootstrap de Super Administrador (ADMIN) no E-commerce Bot
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF EXISTS, Hash BCrypt Work Factor 12 e Role Canônica ADMIN
-- ==============================================================================

DECLARE @AdminEmail NVARCHAR(256) = 'admin@ecommercebot.com'; -- E-mail padrão do Super Admin
DECLARE @AdminRoleId UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111'; -- Role Canônica ADMIN
-- Senha inicial: 'AdminMaster@2026!' (Hash BCrypt Work Factor 12)
DECLARE @PasswordHash NVARCHAR(500) = '$' + '2a$12$5T7toVMF0/rnJ7xlmbYVV.oorIYhR7BZ02e/VpoqZdodnFQLDs0YC';

-- 1. Verifica se o usuário já existe na base
IF EXISTS (SELECT 1 FROM dbo.Users WHERE Email = @AdminEmail)
BEGIN
    UPDATE dbo.Users
    SET PasswordHash = @PasswordHash,
        Role = 'ADMIN',
        RoleId = @AdminRoleId,
        IsActive = 1,
        UpdatedAt = SYSDATETIMEOFFSET()
    WHERE Email = @AdminEmail;

    PRINT '>> Usuário [' + @AdminEmail + '] promovido com sucesso para ADMIN (Super Administrador).';
END
ELSE
BEGIN
    -- Caso o usuário ainda não exista, cria o Tenant Master e o Usuário Super Admin
    DECLARE @MasterTenantId UNIQUEIDENTIFIER = NEWID();
    DECLARE @UserId UNIQUEIDENTIFIER = NEWID();

    -- Cria o Tenant Master da Plataforma
    INSERT INTO dbo.Tenants (Id, Name, Slug, PlanTier, CreditsBalance, IsActive, CreatedAt, UpdatedAt)
    VALUES (@MasterTenantId, 'Administração SaaS Master', 'saas-master', 'enterprise', 10000, 1, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());

    -- Cria o Usuário Super Admin
    INSERT INTO dbo.Users (Id, TenantId, RoleId, FullName, Email, PasswordHash, Role, IsActive, CreatedAt, UpdatedAt)
    VALUES (@UserId, @MasterTenantId, @AdminRoleId, 'Super Administrador', @AdminEmail, @PasswordHash, 'ADMIN', 1, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());

    PRINT '>> Tenant Master e Usuário ADMIN criados com sucesso!';
    PRINT '>> Email: ' + @AdminEmail;
    PRINT '>> Senha temporária: AdminMaster@2026! (Altere imediatamente após o primeiro login)';
END
GO
