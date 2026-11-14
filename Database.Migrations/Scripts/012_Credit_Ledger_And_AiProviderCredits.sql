-- ==============================================================================
-- Script 012: Ledger de Créditos (Append-Only) e FinOps de IA (PostgreSQL 16)
-- E-commerce Bot SaaS
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS dbo;

-- 1. Tabela: AiProviderCredits (FinOps de IA - Pagamentos a Provedores)
CREATE TABLE IF NOT EXISTS dbo.AiProviderCredits (
    Id UUID NOT NULL DEFAULT gen_random_uuid(),
    Provider VARCHAR(50) NOT NULL,
    AmountPaid NUMERIC(18,4) NOT NULL,
    Currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    TokensCredited BIGINT NOT NULL DEFAULT 0,
    BalanceRemaining NUMERIC(18,4) NOT NULL DEFAULT 0,
    TransactionReference VARCHAR(150) NULL,
    Source VARCHAR(50) NOT NULL DEFAULT 'MANUAL_ADMIN',
    Notes VARCHAR(500) NULL,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_AiProviderCredits PRIMARY KEY (Id)
);

CREATE INDEX IF NOT EXISTS IX_AiProviderCredits_Provider_CreatedAt
ON dbo.AiProviderCredits (Provider, CreatedAt DESC)
INCLUDE (AmountPaid, TokensCredited, BalanceRemaining, Source);

-- 2. Tabela: CreditTransactions (Ledger Auditável Append-Only de Créditos IA)
CREATE TABLE IF NOT EXISTS dbo.CreditTransactions (
    Id UUID NOT NULL DEFAULT gen_random_uuid(),
    TenantId UUID NOT NULL,
    OrderId UUID NULL,
    Amount INT NOT NULL,
    BalanceAfter INT NOT NULL,
    Type VARCHAR(50) NOT NULL,
    Description VARCHAR(255) NOT NULL,
    ReferenceId VARCHAR(100) NULL,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_CreditTransactions PRIMARY KEY (Id),
    CONSTRAINT FK_CreditTransactions_Tenants FOREIGN KEY (TenantId) 
        REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CreditTransactions_Orders FOREIGN KEY (OrderId) 
        REFERENCES dbo.Orders(Id),
    CONSTRAINT CK_CreditTransactions_Type CHECK (
        Type IN ('WELCOME_BONUS', 'RECHARGE', 'PRODUCT_ENRICHMENT', 'ML_ANALYSIS', 'REFUND', 'CHARGEBACK_REVERSAL')
    )
);

CREATE INDEX IF NOT EXISTS IX_CreditTransactions_Tenant_CreatedAt
ON dbo.CreditTransactions (TenantId, CreatedAt DESC)
INCLUDE (Amount, BalanceAfter, Type);
