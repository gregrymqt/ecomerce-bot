-- ==============================================================================
-- Script 007: Telemetria e Auditoria de LLM (LLMUsageLogs)
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, UNIQUEIDENTIFIER (NEWSEQUENTIALID()),
--         DATETIMEOFFSET (SYSDATETIMEOFFSET()) e FKs ON DELETE CASCADE
-- ==============================================================================

-- 1. Tabela: LLMUsageLogs (Auditoria Fina de Tokens, Latência e Custos de Inferência)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'LLMUsageLogs' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.LLMUsageLogs (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        ProductId NVARCHAR(150) NULL,
        Provider NVARCHAR(100) NOT NULL,
        ModelUsed NVARCHAR(100) NOT NULL,
        PromptTokens INT NOT NULL DEFAULT 0,
        CompletionTokens INT NOT NULL DEFAULT 0,
        TotalTokens INT NOT NULL DEFAULT 0,
        EstimatedCostUsd DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
        IsByok BIT NOT NULL DEFAULT 0,
        ExecutionTimeMs INT NULL,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_LLMUsageLogs PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_LLMUsageLogs_Tenants FOREIGN KEY (TenantId) 
            REFERENCES dbo.Tenants(Id) ON DELETE CASCADE
    );
END
GO

-- 2. Índice de Cobertura para Agregações e Dashboards de IA por Tenant
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LLMUsageLogs_TenantId_CreatedAt' AND object_id = OBJECT_ID('dbo.LLMUsageLogs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_LLMUsageLogs_TenantId_CreatedAt 
    ON dbo.LLMUsageLogs (TenantId, CreatedAt DESC) 
    INCLUDE (TotalTokens, EstimatedCostUsd);
END
GO
