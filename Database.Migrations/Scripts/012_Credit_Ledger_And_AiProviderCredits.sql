-- ==============================================================================
-- Script 012: Ledger de Créditos (Append-Only) e FinOps de IA (AiProviderCredits)
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, UNIQUEIDENTIFIER (NEWSEQUENTIALID()),
--         DATETIMEOFFSET (SYSDATETIMEOFFSET()), Índices de Cobertura e FKs ON DELETE CASCADE
-- ==============================================================================

-- 1. Tabela: AiProviderCredits (FinOps de IA - Pagamentos a Provedores DeepSeek, Gemini e OpenRouter)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AiProviderCredits' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.AiProviderCredits (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        Provider NVARCHAR(50) NOT NULL, -- 'DEEPSEEK', 'GEMINI', 'OPENROUTER'
        AmountPaid DECIMAL(18,4) NOT NULL,
        Currency NVARCHAR(10) NOT NULL DEFAULT 'USD',
        TokensCredited BIGINT NOT NULL DEFAULT 0,
        BalanceRemaining DECIMAL(18,4) NOT NULL DEFAULT 0,
        TransactionReference NVARCHAR(150) NULL,
        Source NVARCHAR(50) NOT NULL DEFAULT 'MANUAL_ADMIN', -- 'WEBHOOK', 'MANUAL_ADMIN'
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_AiProviderCredits PRIMARY KEY CLUSTERED (Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AiProviderCredits_Provider_CreatedAt' AND object_id = OBJECT_ID('dbo.AiProviderCredits'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_AiProviderCredits_Provider_CreatedAt
    ON dbo.AiProviderCredits (Provider, CreatedAt DESC)
    INCLUDE (AmountPaid, TokensCredited, BalanceRemaining, Source);
END
GO

-- 2. Tabela: CreditTransactions (Ledger Auditável Append-Only de Créditos IA)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CreditTransactions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CreditTransactions (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        OrderId UNIQUEIDENTIFIER NULL,
        Amount INT NOT NULL, -- Positivo para recargas/bônus (+500, +20), negativo para consumos (-1)
        BalanceAfter INT NOT NULL,
        Type NVARCHAR(50) NOT NULL, -- 'WELCOME_BONUS', 'RECHARGE', 'PRODUCT_ENRICHMENT', 'ML_ANALYSIS', 'REFUND', 'CHARGEBACK_REVERSAL'
        Description NVARCHAR(255) NOT NULL,
        ReferenceId NVARCHAR(100) NULL, -- ID do pedido, SKU ou CorrelationId
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_CreditTransactions PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_CreditTransactions_Tenants FOREIGN KEY (TenantId) 
            REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
        CONSTRAINT FK_CreditTransactions_Orders FOREIGN KEY (OrderId) 
            REFERENCES dbo.Orders(Id),
        CONSTRAINT CK_CreditTransactions_Type CHECK (
            Type IN ('WELCOME_BONUS', 'RECHARGE', 'PRODUCT_ENRICHMENT', 'ML_ANALYSIS', 'REFUND', 'CHARGEBACK_REVERSAL')
        )
    );
END
GO

-- Índice de Cobertura para Extrato e Consultas Financeiras por Tenant
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CreditTransactions_Tenant_CreatedAt' AND object_id = OBJECT_ID('dbo.CreditTransactions'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_CreditTransactions_Tenant_CreatedAt
    ON dbo.CreditTransactions (TenantId, CreatedAt DESC)
    INCLUDE (Amount, BalanceAfter, Type);
END
GO
