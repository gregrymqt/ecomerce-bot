-- ==============================================================================
-- Script 001: Tenancy, Usuários e Credenciais de IA (BYOK)
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, UNIQUEIDENTIFIER (NEWSEQUENTIALID())
-- ==============================================================================

-- 1. Tabela: Tenants (Empresas / Lojas Multi-Tenant)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Tenants' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Tenants (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        Name NVARCHAR(150) NOT NULL,
        Slug NVARCHAR(100) NOT NULL,
        PlanTier NVARCHAR(50) NOT NULL DEFAULT 'FREE',
        CreditsBalance INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_Tenants PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_Tenants_Slug UNIQUE NONCLUSTERED (Slug)
    );
END
GO

-- 2. Tabela: Users (Usuários com Isolamento por Tenant)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Users' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Users (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
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
        CONSTRAINT UQ_Users_Tenant_Email UNIQUE NONCLUSTERED (TenantId, Email)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_TenantId' AND object_id = OBJECT_ID('dbo.Users'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Users_TenantId 
    ON dbo.Users (TenantId) 
    INCLUDE (Email, FullName, Role, IsActive);
END
GO

-- 3. Tabela: TenantAiCredentials (Bring Your Own Key - Criptografia AES-256 GCM)
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
