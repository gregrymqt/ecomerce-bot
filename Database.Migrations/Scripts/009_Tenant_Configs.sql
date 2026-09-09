-- ==============================================================================
-- Script 009: Configurações do Tenant (TenantConfigs)
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, UNIQUEIDENTIFIER (NEWSEQUENTIALID()),
--         DATETIMEOFFSET (SYSDATETIMEOFFSET()) e FKs ON DELETE CASCADE
-- ==============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TenantConfigs' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.TenantConfigs (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        AiSettingsJson NVARCHAR(MAX) NULL,
        PricingSettingsJson NVARCHAR(MAX) NULL,
        StoreProfileJson NVARCHAR(MAX) NULL,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_TenantConfigs PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_TenantConfigs_Tenants FOREIGN KEY (TenantId) 
            REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
        CONSTRAINT UQ_TenantConfigs_TenantId UNIQUE NONCLUSTERED (TenantId)
    );
END
GO
