-- ==============================================================================
-- Script 020: Credit Ledger (Transações Append-Only), Pacotes de Recarga e Unificação de Saldos
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, UNIQUEIDENTIFIER (NEWSEQUENTIALID()),
--         DATETIMEOFFSET (SYSDATETIMEOFFSET()), Índices de Cobertura e FKs ON DELETE CASCADE
-- ==============================================================================

-- 1. Tabela: CreditTransactions (Ledger Auditável Append-Only)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CreditTransactions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CreditTransactions (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        OrderId UNIQUEIDENTIFIER NULL,
        Amount INT NOT NULL, -- Positivo para recargas/bônus (+500, +20), negativo para consumos (-1)
        BalanceAfter INT NOT NULL,
        Type NVARCHAR(50) NOT NULL, -- 'WELCOME_BONUS', 'RECHARGE', 'PRODUCT_ENRICHMENT', 'ML_ANALYSIS', 'REFUND'
        Description NVARCHAR(255) NOT NULL,
        ReferenceId NVARCHAR(100) NULL, -- ID do pedido, SKU ou CorrelationId
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_CreditTransactions PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_CreditTransactions_Tenants FOREIGN KEY (TenantId) 
            REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
        CONSTRAINT FK_CreditTransactions_Orders FOREIGN KEY (OrderId) 
            REFERENCES dbo.Orders(Id),
        CONSTRAINT CK_CreditTransactions_Type CHECK (
            Type IN ('WELCOME_BONUS', 'RECHARGE', 'PRODUCT_ENRICHMENT', 'ML_ANALYSIS', 'REFUND')
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

-- 2. Adequação da Tabela dbo.Plans para Pacotes de Recarga Avulsos
-- Tornar colunas legadas de assinatura opcionais (NULL)
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'BillingInterval' AND Object_ID = Object_ID(N'dbo.Plans') AND is_nullable = 0)
BEGIN
    ALTER TABLE dbo.Plans ALTER COLUMN BillingInterval NVARCHAR(20) NULL;
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'TrialDays' AND Object_ID = Object_ID(N'dbo.Plans') AND is_nullable = 0)
BEGIN
    ALTER TABLE dbo.Plans ALTER COLUMN TrialDays INT NULL;
END
GO

-- Inativar planos legados que não sejam os pacotes canônicos
UPDATE dbo.Plans
SET IsActive = 0, UpdatedAt = SYSDATETIMEOFFSET()
WHERE Name NOT IN ('Starter AI', 'Pro AI', 'Scale AI');
GO

-- Inserir / Atualizar Pacotes Canônicos de Recarga Avulsa
-- Pacote 1: Starter AI (R$ 49,00 -> 500 créditos)
IF NOT EXISTS (SELECT 1 FROM dbo.Plans WHERE Name = 'Starter AI')
BEGIN
    INSERT INTO dbo.Plans (Name, Description, Price, CreditsIncluded, BillingInterval, TrialDays, IsActive, CreatedAt, UpdatedAt)
    VALUES ('Starter AI', 'Pacote com 500 créditos avulsos de IA para catálogo e SEO.', 49.00, 500, NULL, NULL, 1, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());
END
ELSE
BEGIN
    UPDATE dbo.Plans
    SET Description = 'Pacote com 500 créditos avulsos de IA para catálogo e SEO.',
        Price = 49.00,
        CreditsIncluded = 500,
        BillingInterval = NULL,
        TrialDays = NULL,
        IsActive = 1,
        UpdatedAt = SYSDATETIMEOFFSET()
    WHERE Name = 'Starter AI';
END
GO

-- Pacote 2: Pro AI (R$ 149,00 -> 2.000 créditos)
IF NOT EXISTS (SELECT 1 FROM dbo.Plans WHERE Name = 'Pro AI')
BEGIN
    INSERT INTO dbo.Plans (Name, Description, Price, CreditsIncluded, BillingInterval, TrialDays, IsActive, CreatedAt, UpdatedAt)
    VALUES ('Pro AI', 'Pacote mais escolhido com 2.000 créditos avulsos de IA para catálogo em escala.', 149.00, 2000, NULL, NULL, 1, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());
END
ELSE
BEGIN
    UPDATE dbo.Plans
    SET Description = 'Pacote mais escolhido com 2.000 créditos avulsos de IA para catálogo em escala.',
        Price = 149.00,
        CreditsIncluded = 2000,
        BillingInterval = NULL,
        TrialDays = NULL,
        IsActive = 1,
        UpdatedAt = SYSDATETIMEOFFSET()
    WHERE Name = 'Pro AI';
END
GO

-- Pacote 3: Scale AI (R$ 399,00 -> 6.000 créditos)
IF NOT EXISTS (SELECT 1 FROM dbo.Plans WHERE Name = 'Scale AI')
BEGIN
    INSERT INTO dbo.Plans (Name, Description, Price, CreditsIncluded, BillingInterval, TrialDays, IsActive, CreatedAt, UpdatedAt)
    VALUES ('Scale AI', 'Pacote de alta escala com 6.000 créditos avulsos de IA com melhor custo por crédito.', 399.00, 6000, NULL, NULL, 1, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());
END
ELSE
BEGIN
    UPDATE dbo.Plans
    SET Description = 'Pacote de alta escala com 6.000 créditos avulsos de IA com melhor custo por crédito.',
        Price = 399.00,
        CreditsIncluded = 6000,
        BillingInterval = NULL,
        TrialDays = NULL,
        IsActive = 1,
        UpdatedAt = SYSDATETIMEOFFSET()
    WHERE Name = 'Scale AI';
END
GO

-- 3. Unificação de Saldos e Garantia de 20 Créditos de Onboarding
-- Atualiza Default da coluna CreditsBalance para 20
DECLARE @DefConst NVARCHAR(200);
SELECT @DefConst = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.Tenants') AND c.name = 'CreditsBalance';

IF @DefConst IS NOT NULL
BEGIN
    EXEC('ALTER TABLE dbo.Tenants DROP CONSTRAINT ' + @DefConst);
END
ALTER TABLE dbo.Tenants ADD CONSTRAINT DF_Tenants_CreditsBalance DEFAULT 20 FOR CreditsBalance;
GO

-- Consolidação de ManagedCreditBalance em CreditsBalance (se existir saldo pendente)
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'ManagedCreditBalance' AND Object_ID = Object_ID(N'dbo.Tenants'))
BEGIN
    -- Converte saldo em R$ para créditos (R$ 1,00 = 10 créditos) e registra no Ledger
    INSERT INTO dbo.CreditTransactions (TenantId, Amount, BalanceAfter, Type, Description, CreatedAt)
    SELECT 
        t.Id,
        CAST(CEILING(t.ManagedCreditBalance * 10) AS INT),
        t.CreditsBalance + CAST(CEILING(t.ManagedCreditBalance * 10) AS INT),
        'RECHARGE',
        'Consolidação de Saldo Gerenciado (R$ ' + CAST(CAST(t.ManagedCreditBalance AS DECIMAL(18,2)) AS NVARCHAR(30)) + ') em Créditos de IA',
        SYSDATETIMEOFFSET()
    FROM dbo.Tenants t
    WHERE t.ManagedCreditBalance > 0;

    UPDATE dbo.Tenants
    SET CreditsBalance = CreditsBalance + CAST(CEILING(ManagedCreditBalance * 10) AS INT),
        ManagedCreditBalance = 0.000000,
        UpdatedAt = SYSDATETIMEOFFSET()
    WHERE ManagedCreditBalance > 0;
END
GO

-- Conceder 20 créditos bônus para tenants que estiverem com saldo 0
UPDATE dbo.Tenants
SET CreditsBalance = 20,
    UpdatedAt = SYSDATETIMEOFFSET()
WHERE CreditsBalance = 0;
GO

-- Inicializar o Ledger para tenants existentes que ainda não possuam transações registradas
INSERT INTO dbo.CreditTransactions (TenantId, Amount, BalanceAfter, Type, Description, CreatedAt)
SELECT 
    t.Id,
    t.CreditsBalance,
    t.CreditsBalance,
    'WELCOME_BONUS',
    'Créditos de boas-vindas / Saldo inicial no novo Ledger',
    SYSDATETIMEOFFSET()
FROM dbo.Tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.CreditTransactions ct WHERE ct.TenantId = t.Id
);
GO
