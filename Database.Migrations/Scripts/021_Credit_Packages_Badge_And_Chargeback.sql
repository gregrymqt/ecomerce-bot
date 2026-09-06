-- ==============================================================================
-- Script 021: Credit Packages Badge e Reversão de Estorno/Chargeback
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, UNIQUEIDENTIFIER (NEWSEQUENTIALID()),
--         DATETIMEOFFSET (SYSDATETIMEOFFSET()), Índices de Cobertura e FKs ON DELETE CASCADE
-- ==============================================================================

-- 1. Adicionar coluna Badge na tabela dbo.Plans para destacar pacotes no frontend
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'Badge' AND Object_ID = Object_ID(N'dbo.Plans'))
BEGIN
    ALTER TABLE dbo.Plans ADD Badge NVARCHAR(50) NULL;
END
GO

-- 2. Atualizar a constraint CK_CreditTransactions_Type para suportar 'CHARGEBACK_REVERSAL'
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CreditTransactions_Type')
BEGIN
    ALTER TABLE dbo.CreditTransactions DROP CONSTRAINT CK_CreditTransactions_Type;
END
GO

ALTER TABLE dbo.CreditTransactions ADD CONSTRAINT CK_CreditTransactions_Type CHECK (
    Type IN ('WELCOME_BONUS', 'RECHARGE', 'PRODUCT_ENRICHMENT', 'ML_ANALYSIS', 'REFUND', 'CHARGEBACK_REVERSAL')
);
GO

-- 3. Atualizar Badges dos pacotes canônicos na tabela dbo.Plans
UPDATE dbo.Plans
SET Badge = 'Mais Escolhido',
    UpdatedAt = SYSDATETIMEOFFSET()
WHERE Name = 'Pro AI';
GO

UPDATE dbo.Plans
SET Badge = 'Melhor Custo',
    UpdatedAt = SYSDATETIMEOFFSET()
WHERE Name = 'Scale AI';
GO

UPDATE dbo.Plans
SET Badge = NULL,
    UpdatedAt = SYSDATETIMEOFFSET()
WHERE Name = 'Starter AI';
GO
