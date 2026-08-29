-- ==============================================================================
-- Script 016: Roles Canônicas (RBAC) e Mapeamento SSO por Tenant (TenantSsoMappings)
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, UNIQUEIDENTIFIER (NEWSEQUENTIALID())
-- ==============================================================================

-- 1. Tabela: Roles (Papéis Canônicos e Globais do Sistema)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Roles' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Roles (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        Name NVARCHAR(50) NOT NULL,
        Description NVARCHAR(255) NOT NULL,
        IsSystemRole BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_Roles PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_Roles_Name UNIQUE NONCLUSTERED (Name)
    );
END
GO

-- 2. Seed Idempotente de Roles Canônicas
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = 'ADMIN')
BEGIN
    INSERT INTO dbo.Roles (Id, Name, Description, IsSystemRole)
    VALUES ('11111111-1111-1111-1111-111111111111', 'ADMIN', 'Super Administrador do Sistema e Plataforma SaaS', 1);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = 'TENANT_ADMIN')
BEGIN
    INSERT INTO dbo.Roles (Id, Name, Description, IsSystemRole)
    VALUES ('22222222-2222-2222-2222-222222222222', 'TENANT_ADMIN', 'Administrador da Empresa / Loja Contratante (Controle total do Tenant)', 1);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = 'CATALOG_OPERATOR')
BEGIN
    INSERT INTO dbo.Roles (Id, Name, Description, IsSystemRole)
    VALUES ('33333333-3333-3333-3333-333333333333', 'CATALOG_OPERATOR', 'Operador de Catálogo, IA e Extração de Produtos', 1);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = 'MEMBER')
BEGIN
    INSERT INTO dbo.Roles (Id, Name, Description, IsSystemRole)
    VALUES ('44444444-4444-4444-4444-444444444444', 'MEMBER', 'Membro Padrão da Equipe do Tenant', 1);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = 'VIEWER')
BEGIN
    INSERT INTO dbo.Roles (Id, Name, Description, IsSystemRole)
    VALUES ('55555555-5555-5555-5555-555555555555', 'VIEWER', 'Visualizador de Apenas Leitura', 1);
END
GO

-- 3. Evolução da Tabela Users: Adicionar Coluna RoleId com FK
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'RoleId' AND object_id = OBJECT_ID('dbo.Users'))
BEGIN
    ALTER TABLE dbo.Users ADD RoleId UNIQUEIDENTIFIER NULL;
END
GO

-- 4. Backfill de RoleId para Usuários Existentes com base na Coluna Role textual
UPDATE u
SET u.RoleId = r.Id
FROM dbo.Users u
INNER JOIN dbo.Roles r ON UPPER(u.Role) = UPPER(r.Name)
WHERE u.RoleId IS NULL;
GO

-- Default de segurança caso algum usuário tenha role não mapeada
UPDATE dbo.Users
SET RoleId = '44444444-4444-4444-4444-444444444444' -- MEMBER
WHERE RoleId IS NULL;
GO

-- 5. Foreign Key de Users para Roles
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Users_Roles' AND parent_object_id = OBJECT_ID('dbo.Users'))
BEGIN
    ALTER TABLE dbo.Users
    ADD CONSTRAINT FK_Users_Roles FOREIGN KEY (RoleId)
        REFERENCES dbo.Roles(Id);
END
GO

-- 6. Índice de Performance em Users para Multi-Tenancy e Role
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_TenantId_RoleId' AND object_id = OBJECT_ID('dbo.Users'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Users_TenantId_RoleId
    ON dbo.Users (TenantId, RoleId)
    INCLUDE (Email, FullName, Role, IsActive);
END
GO

-- 7. Tabela: TenantSsoMappings (Mapeamento de Grupos do IdP para Roles por Tenant)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TenantSsoMappings' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.TenantSsoMappings (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        IdpGroupName NVARCHAR(150) NOT NULL,
        RoleId UNIQUEIDENTIFIER NOT NULL,
        IsDefaultRole BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_TenantSsoMappings PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_TenantSsoMappings_Tenants FOREIGN KEY (TenantId) 
            REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TenantSsoMappings_Roles FOREIGN KEY (RoleId) 
            REFERENCES dbo.Roles(Id),
        CONSTRAINT UQ_TenantSsoMappings_Tenant_Group UNIQUE NONCLUSTERED (TenantId, IdpGroupName)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TenantSsoMappings_TenantId' AND object_id = OBJECT_ID('dbo.TenantSsoMappings'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_TenantSsoMappings_TenantId
    ON dbo.TenantSsoMappings (TenantId, RoleId)
    INCLUDE (IdpGroupName, IsDefaultRole);
END
GO
