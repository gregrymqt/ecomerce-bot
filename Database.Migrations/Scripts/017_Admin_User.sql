-- ==============================================================================
-- BOOTSTRAP: Criação / Promoção de Super Administrador (ADMIN) no E-commerce Bot
-- ==============================================================================
DECLARE @AdminEmail NVARCHAR(256) = 'admin@ecommercebot.com'; -- E-mail padrão do Super Admin

-- 1. Verifica se o usuário já existe na base
IF EXISTS (SELECT 1 FROM dbo.Users WHERE Email = @AdminEmail)
BEGIN
    -- Promove o usuário existente para ADMIN
    UPDATE dbo.Users
    SET Role = 'ADMIN',
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
    
    -- Senha temporária: 'AdminMaster@2026!' (Hash BCrypt Work Factor 12)
    DECLARE @PasswordHash NVARCHAR(500) = '$' + '2a$12$5T7toVMF0/rnJ7xlmbYVV.oorIYhR7BZ02e/VpoqZdodnFQLDs0YC';

    -- 1. Cria o Tenant Master da Plataforma
    INSERT INTO dbo.Tenants (Id, Name, Slug, PlanTier, IsActive, CreatedAt)
    VALUES (@MasterTenantId, 'Administração SaaS Master', 'saas-master', 'enterprise', 1, SYSDATETIMEOFFSET());

    -- 2. Cria o Usuário Super Admin
    INSERT INTO dbo.Users (Id, TenantId, FullName, Email, PasswordHash, Role, IsActive, CreatedAt)
    VALUES (@UserId, @MasterTenantId, 'Super Administrador', @AdminEmail, @PasswordHash, 'ADMIN', 1, SYSDATETIMEOFFSET());

    PRINT '>> Tenant Master e Usuário ADMIN criados com sucesso!';
    PRINT '>> Email: ' + @AdminEmail;
    PRINT '>> Senha temporária: AdminMaster@2026! (Altere imediatamente após o primeiro login)';
END
GO