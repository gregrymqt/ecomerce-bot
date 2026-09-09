-- ==============================================================================
-- Script 004: Rastreamento de Tráfego, Atribuição Multi-Tenant e Métricas do SaaS
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, UNIQUEIDENTIFIER (NEWSEQUENTIALID()),
--         DATETIMEOFFSET (SYSDATETIMEOFFSET()), Índices Non-Clustered Otimizados
-- ==============================================================================

-- 1. Tabela: TrafficAttributions (Métricas de Tráfego, Ads e Atribuição do E-commerce dos Tenants)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TrafficAttributions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.TrafficAttributions (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        OrderId UNIQUEIDENTIFIER NULL,
        SessionId NVARCHAR(100) NOT NULL,
        UtmSource NVARCHAR(100) NULL,
        UtmMedium NVARCHAR(100) NULL,
        UtmCampaign NVARCHAR(150) NULL,
        UtmTerm NVARCHAR(150) NULL,
        UtmContent NVARCHAR(150) NULL,
        AdId NVARCHAR(100) NULL,
        FbClid NVARCHAR(250) NULL,
        GClid NVARCHAR(250) NULL,
        IpAddress NVARCHAR(50) NULL,
        UserAgent NVARCHAR(500) NULL,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_TrafficAttributions PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_TrafficAttributions_Tenants FOREIGN KEY (TenantId) 
            REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TrafficAttributions_Orders FOREIGN KEY (OrderId) 
            REFERENCES dbo.Orders(Id) ON DELETE NO ACTION
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TrafficAttributions_Tenant_CreatedAt' AND object_id = OBJECT_ID('dbo.TrafficAttributions'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_TrafficAttributions_Tenant_CreatedAt
    ON dbo.TrafficAttributions (TenantId, CreatedAt DESC)
    INCLUDE (UtmSource, UtmCampaign, AdId, OrderId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TrafficAttributions_OrderId' AND object_id = OBJECT_ID('dbo.TrafficAttributions'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_TrafficAttributions_OrderId
    ON dbo.TrafficAttributions (OrderId)
    WHERE OrderId IS NOT NULL;
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

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SaasTrafficVisits_CreatedAt_Campaign' AND object_id = OBJECT_ID('dbo.SaasTrafficVisits'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_SaasTrafficVisits_CreatedAt_Campaign
    ON dbo.SaasTrafficVisits (CreatedAt DESC)
    INCLUDE (UtmSource, UtmCampaign, AdId, SessionId);
END
GO

-- 3. Tabela: SaasAdSpends (Investimento em Mídia Paga para Análise de CAC e ROAS da Plataforma)
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

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SaasAdSpends_Period' AND object_id = OBJECT_ID('dbo.SaasAdSpends'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_SaasAdSpends_Period
    ON dbo.SaasAdSpends (PeriodStart, PeriodEnd)
    INCLUDE (CampaignName, UtmSource, AmountSpentBrl);
END
GO
