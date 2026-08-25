-- ==============================================================================
-- Script 004: Rastreamento de Tráfego e Atribuição de Conversões (UTMs & Ads)
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, Índices Non-Clustered Otimizados
-- ==============================================================================

-- 1. Tabela: TrafficAttributions (Métricas de Tráfego, Ads e Atribuição Multi-Tenant)
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
            REFERENCES dbo.Orders(Id) ON DELETE SET NULL
    );
END
GO

-- 2. Índice para Análise de Campanhas e Tráfego por Tenant
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TrafficAttributions_Tenant_CreatedAt' AND object_id = OBJECT_ID('dbo.TrafficAttributions'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_TrafficAttributions_Tenant_CreatedAt
    ON dbo.TrafficAttributions (TenantId, CreatedAt DESC)
    INCLUDE (UtmSource, UtmCampaign, AdId, OrderId);
END
GO

-- 3. Índice Filtrado para Conversões com Pedidos
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TrafficAttributions_OrderId' AND object_id = OBJECT_ID('dbo.TrafficAttributions'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_TrafficAttributions_OrderId
    ON dbo.TrafficAttributions (OrderId)
    WHERE OrderId IS NOT NULL;
END
GO
