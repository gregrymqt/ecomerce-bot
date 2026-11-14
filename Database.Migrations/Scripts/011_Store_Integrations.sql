-- ==============================================================================
-- Script 011: Integrações de Lojas Multi-Tenant (PostgreSQL 16)
-- E-commerce Bot SaaS
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS dbo;

-- 1. Tabela: StoreIntegrations (Gestão de Conexões e Credenciais Criptografadas AES-256 GCM)
CREATE TABLE IF NOT EXISTS dbo.StoreIntegrations (
    Id UUID NOT NULL DEFAULT gen_random_uuid(),
    TenantId UUID NOT NULL,
    Platform VARCHAR(50) NOT NULL,
    StoreDomain VARCHAR(255) NOT NULL,
    EncryptedAccessToken BYTEA NOT NULL,
    EncryptedClientSecret BYTEA NULL,
    InitializationVector BYTEA NOT NULL,
    AuthTag BYTEA NOT NULL,
    Status VARCHAR(30) NOT NULL DEFAULT 'CONNECTED',
    HealthCheckStatus VARCHAR(200) NULL,
    HealthCheckLatencyMs INT NULL,
    LastHealthCheckAt TIMESTAMPTZ NULL,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UpdatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_StoreIntegrations PRIMARY KEY (Id),
    CONSTRAINT FK_StoreIntegrations_Tenants FOREIGN KEY (TenantId) 
        REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT UQ_StoreIntegrations_Tenant_Platform_Domain UNIQUE (TenantId, Platform, StoreDomain)
);

-- 2. Índice de Cobertura para Resolução Rápida de Webhooks por Domínio e Plataforma
CREATE INDEX IF NOT EXISTS IX_StoreIntegrations_Platform_Domain
ON dbo.StoreIntegrations (Platform, StoreDomain)
INCLUDE (TenantId, Status, EncryptedAccessToken, InitializationVector, AuthTag);

-- 3. Índice para Listagem de Integrações do Tenant no Dashboard
CREATE INDEX IF NOT EXISTS IX_StoreIntegrations_Tenant_Status
ON dbo.StoreIntegrations (TenantId, Status)
INCLUDE (Platform, StoreDomain, HealthCheckStatus, HealthCheckLatencyMs, LastHealthCheckAt);
