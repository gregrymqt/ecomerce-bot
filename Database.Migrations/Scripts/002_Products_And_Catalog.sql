-- ==============================================================================
-- Script 002: Produtos, Catálogo Multi-Tenant e Integrações E-commerce
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, Clustered Index Composto (TenantId, Sku),
--         DATETIMEOFFSET (SYSDATETIMEOFFSET()) e FKs ON DELETE CASCADE
-- ==============================================================================

-- 1. Tabela: Products (Catálogo de Produtos Multi-Tenant com suporte nativo Shopify e Nuvemshop)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Products' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Products (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        Sku NVARCHAR(100) NOT NULL,
        Title NVARCHAR(500) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        OriginalPrice DECIMAL(18,2) NULL,
        Price DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        Category NVARCHAR(200) NULL,
        Brand NVARCHAR(150) NULL,
        StockQuantity INT NOT NULL DEFAULT 0,
        Status NVARCHAR(30) NOT NULL DEFAULT 'RAW', -- 'RAW', 'PROCESSING', 'PROCESSED', 'FAILED'
        SourceUrl NVARCHAR(1000) NULL,
        ImagesJson NVARCHAR(MAX) NULL, -- Array JSON de URLs de imagens
        EnrichmentMetadata NVARCHAR(MAX) NULL, -- JSON com model_used, prompt_tokens, completion_tokens, response_time_ms
        ErrorMessage NVARCHAR(MAX) NULL,
        ShopifyProductId NVARCHAR(100) NULL,
        ShopifyVariantId NVARCHAR(100) NULL,
        ShopifyInventoryItemId NVARCHAR(100) NULL,
        NuvemshopProductId NVARCHAR(100) NULL,
        NuvemshopVariantId NVARCHAR(100) NULL,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_Products PRIMARY KEY NONCLUSTERED (Id),
        CONSTRAINT UQ_Products_Tenant_Sku UNIQUE CLUSTERED (TenantId, Sku),
        CONSTRAINT FK_Products_Tenants FOREIGN KEY (TenantId) 
            REFERENCES dbo.Tenants(Id) ON DELETE CASCADE
    );
END
GO

-- 2. Índice Filtrado: Busca rápida pelo Worker de Produtos Pendentes (RAW)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Products_Pending_Processing' AND object_id = OBJECT_ID('dbo.Products'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Products_Pending_Processing
    ON dbo.Products (TenantId, CreatedAt)
    INCLUDE (Sku, Title, SourceUrl)
    WHERE Status = 'RAW';
END
GO

-- 3. Índice de Cobertura: Listagem e Paginação de Catálogo no Dashboard
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Products_Tenant_Status_CreatedAt' AND object_id = OBJECT_ID('dbo.Products'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Products_Tenant_Status_CreatedAt
    ON dbo.Products (TenantId, Status, CreatedAt DESC)
    INCLUDE (Sku, Title, Price, Brand, Category, StockQuantity);
END
GO

-- 4. Índice de Cobertura para Resolução Rápida de Webhooks Nuvemshop
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Products_Tenant_NuvemshopProduct' AND object_id = OBJECT_ID('dbo.Products'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Products_Tenant_NuvemshopProduct
    ON dbo.Products (TenantId, NuvemshopProductId)
    INCLUDE (Sku, Title, Price, StockQuantity)
    WHERE NuvemshopProductId IS NOT NULL;
END
GO
