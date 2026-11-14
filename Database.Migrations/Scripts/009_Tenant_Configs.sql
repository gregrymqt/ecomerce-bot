-- ==============================================================================
-- Script 009: Configurações do Tenant (TenantConfigs) (PostgreSQL 16)
-- E-commerce Bot SaaS
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS dbo;

CREATE TABLE IF NOT EXISTS dbo.TenantConfigs (
    Id UUID NOT NULL DEFAULT gen_random_uuid(),
    TenantId UUID NOT NULL,
    AiSettingsJson TEXT NULL,
    PricingSettingsJson TEXT NULL,
    StoreProfileJson TEXT NULL,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UpdatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_TenantConfigs PRIMARY KEY (Id),
    CONSTRAINT FK_TenantConfigs_Tenants FOREIGN KEY (TenantId) 
        REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT UQ_TenantConfigs_TenantId UNIQUE (TenantId)
);
