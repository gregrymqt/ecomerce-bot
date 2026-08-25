-- ==============================================================================
-- Script 002: Produtos, Catálogo e Enriquecimento via IA
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, Clustered Index Composto (TenantId, Sku)
-- ==============================================================================

-- 1. Tabela: Products (Catálogo de Produtos Multi-Tenant)
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
