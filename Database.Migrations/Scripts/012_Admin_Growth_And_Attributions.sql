-- ==============================================================================
-- Script 012: Admin Growth, Atribuição de Tráfego do SaaS e Gestão de Mídia
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, UNIQUEIDENTIFIER (NEWSEQUENTIALID())
-- ==============================================================================

-- 1. Adicionar colunas de Primeiro Toque (First-Touch Attribution) na tabela Tenants
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'FirstUtmSource' AND Object_ID = Object_ID(N'dbo.Tenants'))
BEGIN
    ALTER TABLE dbo.Tenants ADD FirstUtmSource NVARCHAR(100) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'FirstUtmMedium' AND Object_ID = Object_ID(N'dbo.Tenants'))
BEGIN
    ALTER TABLE dbo.Tenants ADD FirstUtmMedium NVARCHAR(100) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'FirstUtmCampaign' AND Object_ID = Object_ID(N'dbo.Tenants'))
BEGIN
    ALTER TABLE dbo.Tenants ADD FirstUtmCampaign NVARCHAR(150) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'FirstAdId' AND Object_ID = Object_ID(N'dbo.Tenants'))
BEGIN
    ALTER TABLE dbo.Tenants ADD FirstAdId NVARCHAR(100) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'FirstTouchAt' AND Object_ID = Object_ID(N'dbo.Tenants'))
BEGIN
    ALTER TABLE dbo.Tenants ADD FirstTouchAt DATETIMEOFFSET NULL;
END
GO


-- 2. Tabela: SaasTrafficVisits (Rastreamento de Pageviews & Origem na Landing Page e Auth do SaaS)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SaasTrafficVisits' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.SaasTrafficVisits (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        SessionId NVARCHAR(100) NOT NULL,
        Path NVARCHAR(250) NOT NULL,
        UtmSource NVARCHAR(100) NULL,
        UtmMedium NVARCHAR(100) NULL,
        UtmCampaign NVARCHAR(150) NULL,
        UtmContent NVARCHAR(150) NULL,
        UtmTerm NVARCHAR(150) NULL,
        AdId NVARCHAR(100) NULL,
        FbClid NVARCHAR(250) NULL,
        GClid NVARCHAR(250) NULL,
        IpAddress NVARCHAR(50) NULL,
        UserAgent NVARCHAR(500) NULL,
        Referrer NVARCHAR(500) NULL,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_SaasTrafficVisits PRIMARY KEY CLUSTERED (Id)
    );
END
GO

-- Índice Non-Clustered para agregação temporal e por campanha
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SaasTrafficVisits_CreatedAt_Campaign' AND object_id = OBJECT_ID('dbo.SaasTrafficVisits'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_SaasTrafficVisits_CreatedAt_Campaign
    ON dbo.SaasTrafficVisits (CreatedAt DESC)
    INCLUDE (UtmSource, UtmCampaign, AdId, SessionId);
END
GO


-- 3. Tabela: SaasAdSpends (Lançamento de Investimento em Tráfego Pago / Mídia para CAC e ROAS)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SaasAdSpends' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.SaasAdSpends (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        CampaignName NVARCHAR(150) NOT NULL,
        UtmSource NVARCHAR(100) NOT NULL DEFAULT 'meta_ads',
        AdId NVARCHAR(100) NULL,
        AmountSpentBrl DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        PeriodStart DATETIMEOFFSET NOT NULL,
        PeriodEnd DATETIMEOFFSET NOT NULL,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_SaasAdSpends PRIMARY KEY CLUSTERED (Id)
    );
END
GO

-- Índice Non-Clustered para consultas de custos por período e canal
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SaasAdSpends_Period' AND object_id = OBJECT_ID('dbo.SaasAdSpends'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_SaasAdSpends_Period
    ON dbo.SaasAdSpends (PeriodStart, PeriodEnd)
    INCLUDE (CampaignName, UtmSource, AmountSpentBrl);
END
GO
