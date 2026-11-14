-- ==============================================================================
-- Script 001: Tenancy, Roles Canônicas (RBAC), Usuários e SSO (PostgreSQL 16)
-- E-commerce Bot SaaS
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS dbo;

-- 1. Tabela: Tenants (Empresas / Lojas Multi-Tenant)
CREATE TABLE IF NOT EXISTS dbo.Tenants (
    Id UUID NOT NULL DEFAULT gen_random_uuid(),
    Name VARCHAR(150) NOT NULL,
    Slug VARCHAR(100) NOT NULL,
    PlanTier VARCHAR(50) NOT NULL DEFAULT 'FREE',
    CreditsBalance INT NOT NULL DEFAULT 20,
    ManagedCreditBalance NUMERIC(18,6) NOT NULL DEFAULT 0.000000,
    FirstUtmSource VARCHAR(100) NULL,
    FirstUtmMedium VARCHAR(100) NULL,
    FirstUtmCampaign VARCHAR(150) NULL,
    FirstAdId VARCHAR(100) NULL,
    FirstTouchAt TIMESTAMPTZ NULL,
    IsActive BOOLEAN NOT NULL DEFAULT TRUE,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UpdatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_Tenants PRIMARY KEY (Id),
    CONSTRAINT UQ_Tenants_Slug UNIQUE (Slug)
);

-- 2. Tabela: Roles (Papéis Canônicos e Globais do Sistema)
CREATE TABLE IF NOT EXISTS dbo.Roles (
    Id UUID NOT NULL DEFAULT gen_random_uuid(),
    Name VARCHAR(50) NOT NULL,
    Description VARCHAR(255) NOT NULL,
    IsSystemRole BOOLEAN NOT NULL DEFAULT TRUE,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_Roles PRIMARY KEY (Id),
    CONSTRAINT UQ_Roles_Name UNIQUE (Name)
);

-- Seed Idempotente de Roles Canônicas
INSERT INTO dbo.Roles (Id, Name, Description, IsSystemRole)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'ADMIN', 'Super Administrador do Sistema e Plataforma SaaS', TRUE),
    ('22222222-2222-2222-2222-222222222222', 'TENANT_ADMIN', 'Administrador da Empresa / Loja Contratante (Controle total do Tenant)', TRUE),
    ('33333333-3333-3333-3333-333333333333', 'CATALOG_OPERATOR', 'Operador de Catálogo, IA e Extração de Produtos', TRUE),
    ('44444444-4444-4444-4444-444444444444', 'MEMBER', 'Membro Padrão da Equipe do Tenant', TRUE),
    ('55555555-5555-5555-5555-555555555555', 'VIEWER', 'Visualizador de Apenas Leitura', TRUE)
ON CONFLICT (Name) DO NOTHING;

-- 3. Tabela: Users (Usuários com Isolamento por Tenant e Role RBAC)
CREATE TABLE IF NOT EXISTS dbo.Users (
    Id UUID NOT NULL DEFAULT gen_random_uuid(),
    TenantId UUID NOT NULL,
    RoleId UUID NOT NULL DEFAULT '44444444-4444-4444-4444-444444444444',
    Email VARCHAR(255) NOT NULL,
    PasswordHash VARCHAR(500) NOT NULL,
    FullName VARCHAR(150) NULL,
    Role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
    IsActive BOOLEAN NOT NULL DEFAULT TRUE,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UpdatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_Users PRIMARY KEY (Id),
    CONSTRAINT FK_Users_Tenants FOREIGN KEY (TenantId) 
        REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Users_Roles FOREIGN KEY (RoleId) 
        REFERENCES dbo.Roles(Id),
    CONSTRAINT UQ_Users_Tenant_Email UNIQUE (TenantId, Email)
);

CREATE INDEX IF NOT EXISTS IX_Users_TenantId_RoleId 
ON dbo.Users (TenantId, RoleId) 
INCLUDE (Email, FullName, Role, IsActive);

-- 4. Tabela: TenantAiCredentials (Bring Your Own Key - Criptografia AES-256 GCM)
CREATE TABLE IF NOT EXISTS dbo.TenantAiCredentials (
    Id UUID NOT NULL DEFAULT gen_random_uuid(),
    TenantId UUID NOT NULL,
    Provider VARCHAR(50) NOT NULL,
    EncryptedApiKey BYTEA NOT NULL,
    InitializationVector BYTEA NOT NULL,
    AuthTag BYTEA NOT NULL,
    IsActive BOOLEAN NOT NULL DEFAULT TRUE,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UpdatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_TenantAiCredentials PRIMARY KEY (Id),
    CONSTRAINT FK_TenantAiCredentials_Tenants FOREIGN KEY (TenantId) 
        REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT UQ_TenantAiCredentials_Tenant_Provider UNIQUE (TenantId, Provider)
);

CREATE INDEX IF NOT EXISTS IX_TenantAiCredentials_Tenant_Active 
ON dbo.TenantAiCredentials (TenantId, IsActive) 
INCLUDE (Provider);

-- 5. Tabela: TenantSsoMappings (Mapeamento de Grupos do IdP para Roles por Tenant)
CREATE TABLE IF NOT EXISTS dbo.TenantSsoMappings (
    Id UUID NOT NULL DEFAULT gen_random_uuid(),
    TenantId UUID NOT NULL,
    IdpGroupName VARCHAR(150) NOT NULL,
    RoleId UUID NOT NULL,
    IsDefaultRole BOOLEAN NOT NULL DEFAULT FALSE,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UpdatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_TenantSsoMappings PRIMARY KEY (Id),
    CONSTRAINT FK_TenantSsoMappings_Tenants FOREIGN KEY (TenantId) 
        REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT FK_TenantSsoMappings_Roles FOREIGN KEY (RoleId) 
        REFERENCES dbo.Roles(Id),
    CONSTRAINT UQ_TenantSsoMappings_Tenant_Group UNIQUE (TenantId, IdpGroupName)
);

CREATE INDEX IF NOT EXISTS IX_TenantSsoMappings_TenantId
ON dbo.TenantSsoMappings (TenantId, RoleId)
INCLUDE (IdpGroupName, IsDefaultRole);
