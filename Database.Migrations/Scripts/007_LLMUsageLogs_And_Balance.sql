-- ==============================================================================
-- Script 007: AI Metering (Logs de Uso e Saldo)
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, UNIQUEIDENTIFIER
-- ==============================================================================

-- 1. Adicionar/Alterar coluna de Saldo Gerenciado na tabela Tenants
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'CreditsBalance' AND Object_ID = Object_ID(N'dbo.Tenants'))
BEGIN
    -- Renomear e alterar tipo não é trivial de forma idempotente sem recriar se já tiver dados.
    -- Como estamos seguindo o script anterior que definiu CreditsBalance como INT,
    -- vamos dropar a coluna e adicionar a nova se ela não existir. 
    -- Para segurança e idempotência em produção, faríamos diferente. Aqui assumimos ambiente controlado.
    
    -- Dropamos constraint default de CreditsBalance se houver:
    DECLARE @default_constraint_name sysname;
    SELECT @default_constraint_name = default_constraints.name
    FROM sys.all_columns
    INNER JOIN sys.tables ON all_columns.object_id = tables.object_id
    INNER JOIN sys.default_constraints ON all_columns.default_object_id = default_constraints.object_id
    WHERE tables.name = 'Tenants' AND all_columns.name = 'CreditsBalance';
    
    IF @default_constraint_name IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE dbo.Tenants DROP CONSTRAINT ' + @default_constraint_name);
    END
    
    ALTER TABLE dbo.Tenants DROP COLUMN CreditsBalance;
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
