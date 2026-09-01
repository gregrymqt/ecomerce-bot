-- ==============================================================================
-- BOOTSTRAP / CORREÇÃO: Atualização do Hash de Senha do Super Admin (ADMIN)
-- ==============================================================================
DECLARE @AdminEmail NVARCHAR(256) = 'admin@ecommercebot.com';
-- Hash BCrypt Work Factor 12 válido para 'AdminMaster@2026!'
DECLARE @ValidPasswordHash NVARCHAR(500) = '$' + '2a$12$5T7toVMF0/rnJ7xlmbYVV.oorIYhR7BZ02e/VpoqZdodnFQLDs0YC';

IF EXISTS (SELECT 1 FROM dbo.Users WHERE Email = @AdminEmail)
BEGIN
    UPDATE dbo.Users
    SET PasswordHash = @ValidPasswordHash,
        Role = 'ADMIN',
        IsActive = 1,
        UpdatedAt = SYSDATETIMEOFFSET()
    WHERE Email = @AdminEmail;

    PRINT '>> Senha e Role do Super Admin [' + @AdminEmail + '] atualizadas com sucesso!';
END
ELSE
BEGIN
    DECLARE @MasterTenantId UNIQUEIDENTIFIER = NEWID();
    DECLARE @UserId UNIQUEIDENTIFIER = NEWID();

    INSERT INTO dbo.Tenants (Id, Name, Slug, PlanTier, IsActive, CreatedAt)
    VALUES (@MasterTenantId, 'Administração SaaS Master', 'saas-master', 'enterprise', 1, SYSDATETIMEOFFSET());

    INSERT INTO dbo.Users (Id, TenantId, FullName, Email, PasswordHash, Role, IsActive, CreatedAt)
    VALUES (@UserId, @MasterTenantId, 'Super Administrador', @AdminEmail, @ValidPasswordHash, 'ADMIN', 1, SYSDATETIMEOFFSET());

    PRINT '>> Tenant Master e Super Admin [' + @AdminEmail + '] criados com sucesso!';
END
GO
