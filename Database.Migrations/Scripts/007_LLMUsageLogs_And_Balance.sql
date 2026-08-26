-- ==============================================================================
-- Script 007: AI Metering (Logs de Uso e Saldo)
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, UNIQUEIDENTIFIER
-- ==============================================================================

-- 1. Garantir existência de CreditsBalance (INT) e ManagedCreditBalance (DECIMAL) na tabela Tenants
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'CreditsBalance' AND Object_ID = Object_ID(N'dbo.Tenants'))
BEGIN
    ALTER TABLE dbo.Tenants ADD CreditsBalance INT NOT NULL DEFAULT 0;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'ManagedCreditBalance' AND Object_ID = Object_ID(N'dbo.Tenants'))
BEGIN
    ALTER TABLE dbo.Tenants ADD ManagedCreditBalance DECIMAL(18,6) NOT NULL DEFAULT 0.000000;
END
GO


-- 2. Tabela: LLMUsageLogs
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

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LLMUsageLogs_TenantId_CreatedAt' AND object_id = OBJECT_ID('dbo.LLMUsageLogs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_LLMUsageLogs_TenantId_CreatedAt 
    ON dbo.LLMUsageLogs (TenantId, CreatedAt DESC) 
    INCLUDE (TotalTokens, EstimatedCostUsd);
END
GO
