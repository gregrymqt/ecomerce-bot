-- ==============================================================================
-- Script 004: Rastreamento de Tráfego, Atribuição Multi-Tenant e Métricas do SaaS (PostgreSQL 16)
-- E-commerce Bot SaaS
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS dbo;

-- 1. Tabela: TrafficAttributions (Métricas de Tráfego, Ads e Atribuição do E-commerce dos Tenants)
CREATE TABLE IF NOT EXISTS dbo.TrafficAttributions (
    Id UUID NOT NULL DEFAULT gen_random_uuid(),
    TenantId UUID NOT NULL,
    OrderId UUID NULL,
    SessionId VARCHAR(100) NOT NULL,
    UtmSource VARCHAR(100) NULL,
    UtmMedium VARCHAR(100) NULL,
    UtmCampaign VARCHAR(150) NULL,
    UtmTerm VARCHAR(150) NULL,
    UtmContent VARCHAR(150) NULL,
    AdId VARCHAR(100) NULL,
    FbClid VARCHAR(250) NULL,
    GClid VARCHAR(250) NULL,
    IpAddress VARCHAR(50) NULL,
    UserAgent VARCHAR(500) NULL,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_TrafficAttributions PRIMARY KEY (Id),
    CONSTRAINT FK_TrafficAttributions_Tenants FOREIGN KEY (TenantId) 
        REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT FK_TrafficAttributions_Orders FOREIGN KEY (OrderId) 
        REFERENCES dbo.Orders(Id) ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS IX_TrafficAttributions_Tenant_CreatedAt
ON dbo.TrafficAttributions (TenantId, CreatedAt DESC)
INCLUDE (UtmSource, UtmCampaign, AdId, OrderId);

CREATE INDEX IF NOT EXISTS IX_TrafficAttributions_OrderId
ON dbo.TrafficAttributions (OrderId)
WHERE OrderId IS NOT NULL;

-- 2. Tabela: SaasTrafficVisits (Rastreamento de Pageviews & Origem na Landing Page e Auth do SaaS)
CREATE TABLE IF NOT EXISTS dbo.SaasTrafficVisits (
    Id UUID NOT NULL DEFAULT gen_random_uuid(),
    SessionId VARCHAR(100) NOT NULL,
    Path VARCHAR(250) NOT NULL,
    UtmSource VARCHAR(100) NULL,
    UtmMedium VARCHAR(100) NULL,
    UtmCampaign VARCHAR(150) NULL,
    UtmContent VARCHAR(150) NULL,
    UtmTerm VARCHAR(150) NULL,
    AdId VARCHAR(100) NULL,
    FbClid VARCHAR(250) NULL,
    GClid VARCHAR(250) NULL,
    IpAddress VARCHAR(50) NULL,
    UserAgent VARCHAR(500) NULL,
    Referrer VARCHAR(500) NULL,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_SaasTrafficVisits PRIMARY KEY (Id)
);

CREATE INDEX IF NOT EXISTS IX_SaasTrafficVisits_CreatedAt_Campaign
ON dbo.SaasTrafficVisits (CreatedAt DESC)
INCLUDE (UtmSource, UtmCampaign, AdId, SessionId);

-- 3. Tabela: SaasAdSpends (Investimento em Mídia Paga para Análise de CAC e ROAS da Plataforma)
CREATE TABLE IF NOT EXISTS dbo.SaasAdSpends (
    Id UUID NOT NULL DEFAULT gen_random_uuid(),
    CampaignName VARCHAR(150) NOT NULL,
    UtmSource VARCHAR(100) NOT NULL DEFAULT 'meta_ads',
    AdId VARCHAR(100) NULL,
    AmountSpentBrl NUMERIC(18,2) NOT NULL DEFAULT 0.00,
    PeriodStart TIMESTAMPTZ NOT NULL,
    PeriodEnd TIMESTAMPTZ NOT NULL,
    Notes VARCHAR(500) NULL,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_SaasAdSpends PRIMARY KEY (Id)
);

CREATE INDEX IF NOT EXISTS IX_SaasAdSpends_Period
ON dbo.SaasAdSpends (PeriodStart, PeriodEnd)
INCLUDE (CampaignName, UtmSource, AmountSpentBrl);
