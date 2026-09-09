-- ==============================================================================
-- Script 001: Tenancy, Roles Canônicas (RBAC), Usuários e SSO
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, UNIQUEIDENTIFIER (NEWSEQUENTIALID()),
--         DATETIMEOFFSET (SYSDATETIMEOFFSET()), Índices de Cobertura e FKs ON DELETE CASCADE
-- ==============================================================================

-- 1. Tabela: Tenants (Empresas / Lojas Multi-Tenant)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Tenants' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Tenants (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        Name NVARCHAR(150) NOT NULL,
        Slug NVARCHAR(100) NOT NULL,
        PlanTier NVARCHAR(50) NOT NULL DEFAULT 'FREE',
        CreditsBalance INT NOT NULL DEFAULT 20,
        ManagedCreditBalance DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
        FirstUtmSource NVARCHAR(100) NULL,
        FirstUtmMedium NVARCHAR(100) NULL,
        FirstUtmCampaign NVARCHAR(150) NULL,
        FirstAdId NVARCHAR(100) NULL,
        FirstTouchAt DATETIMEOFFSET NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_Tenants PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_Tenants_Slug UNIQUE NONCLUSTERED (Slug)
    );
END
GO

-- 2. Tabela: Roles (Papéis Canônicos e Globais do Sistema)
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

-- Seed Idempotente de Roles Canônicas
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

-- 3. Tabela: Users (Usuários com Isolamento por Tenant e Role RBAC)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Users' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Users (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        RoleId UNIQUEIDENTIFIER NOT NULL DEFAULT '44444444-4444-4444-4444-444444444444', -- Default MEMBER
        Email NVARCHAR(255) NOT NULL,
        PasswordHash NVARCHAR(500) NOT NULL,
        FullName NVARCHAR(150) NULL,
        Role NVARCHAR(50) NOT NULL DEFAULT 'MEMBER',
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_Users PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_Users_Tenants FOREIGN KEY (TenantId) 
            REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
        CONSTRAINT FK_Users_Roles FOREIGN KEY (RoleId) 
            REFERENCES dbo.Roles(Id),
        CONSTRAINT UQ_Users_Tenant_Email UNIQUE NONCLUSTERED (TenantId, Email)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_TenantId_RoleId' AND object_id = OBJECT_ID('dbo.Users'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Users_TenantId_RoleId 
    ON dbo.Users (TenantId, RoleId) 
    INCLUDE (Email, FullName, Role, IsActive);
END
GO

-- 4. Tabela: TenantAiCredentials (Bring Your Own Key - Criptografia AES-256 GCM)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TenantAiCredentials' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.TenantAiCredentials (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        Provider NVARCHAR(50) NOT NULL, -- 'OpenRouter', 'DeepSeek', 'Groq', 'OpenAI', 'Gemini'
        EncryptedApiKey VARBINARY(MAX) NOT NULL,
        InitializationVector VARBINARY(32) NOT NULL, -- Nonce / IV para AES-256 GCM
        AuthTag VARBINARY(32) NOT NULL, -- Tag de Autenticação GCM
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_TenantAiCredentials PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_TenantAiCredentials_Tenants FOREIGN KEY (TenantId) 
            REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
        CONSTRAINT UQ_TenantAiCredentials_Tenant_Provider UNIQUE NONCLUSTERED (TenantId, Provider)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TenantAiCredentials_Tenant_Active' AND object_id = OBJECT_ID('dbo.TenantAiCredentials'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_TenantAiCredentials_Tenant_Active 
    ON dbo.TenantAiCredentials (TenantId, IsActive) 
    INCLUDE (Provider);
END
GO

-- 5. Tabela: TenantSsoMappings (Mapeamento de Grupos do IdP para Roles por Tenant)
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
