-- ==============================================================================
-- Script 023: Expurgar Assinaturas (Preapproval) e Consolidar Carteira / Ledger
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF EXISTS, DROP TABLE e remoção de colunas legadas
-- ==============================================================================

-- 1. Remover tabela dbo.Subscriptions (Assinaturas recorrentes via MP Preapproval descontinuadas)
IF OBJECT_ID(N'dbo.Subscriptions', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.Subscriptions;
END
GO

-- 2. Remover colunas legadas de Preapproval e recorrência da tabela dbo.Plans
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'MpPreapprovalPlanId' AND Object_ID = Object_ID(N'dbo.Plans'))
BEGIN
    ALTER TABLE dbo.Plans DROP COLUMN MpPreapprovalPlanId;
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'BillingInterval' AND Object_ID = Object_ID(N'dbo.Plans'))
BEGIN
    ALTER TABLE dbo.Plans DROP COLUMN BillingInterval;
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'TrialDays' AND Object_ID = Object_ID(N'dbo.Plans'))
BEGIN
    ALTER TABLE dbo.Plans DROP COLUMN TrialDays;
END
GO
