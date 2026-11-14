-- ==============================================================================
-- Script 002: Produtos, Catálogo Multi-Tenant e Integrações E-commerce (PostgreSQL 16)
-- E-commerce Bot SaaS
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS dbo;

-- 1. Tabela: Products (Catálogo de Produtos Multi-Tenant)
CREATE TABLE IF NOT EXISTS dbo.Products (
    Id UUID NOT NULL DEFAULT gen_random_uuid(),
    TenantId UUID NOT NULL,
    Sku VARCHAR(100) NOT NULL,
    Title VARCHAR(500) NOT NULL,
    Description TEXT NULL,
    OriginalPrice NUMERIC(18,2) NULL,
    Price NUMERIC(18,2) NOT NULL DEFAULT 0.00,
    Category VARCHAR(200) NULL,
    Brand VARCHAR(150) NULL,
    StockQuantity INT NOT NULL DEFAULT 0,
    Status VARCHAR(30) NOT NULL DEFAULT 'RAW',
    SourceUrl VARCHAR(1000) NULL,
    ImagesJson TEXT NULL,
    EnrichmentMetadata TEXT NULL,
    ErrorMessage TEXT NULL,
    ShopifyProductId VARCHAR(100) NULL,
    ShopifyVariantId VARCHAR(100) NULL,
    ShopifyInventoryItemId VARCHAR(100) NULL,
    NuvemshopProductId VARCHAR(100) NULL,
    NuvemshopVariantId VARCHAR(100) NULL,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UpdatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_Products PRIMARY KEY (Id),
    CONSTRAINT UQ_Products_Tenant_Sku UNIQUE (TenantId, Sku),
    CONSTRAINT FK_Products_Tenants FOREIGN KEY (TenantId) 
        REFERENCES dbo.Tenants(Id) ON DELETE CASCADE
);

-- 2. Índice Filtrado: Busca rápida pelo Worker de Produtos Pendentes (RAW)
CREATE INDEX IF NOT EXISTS IX_Products_Pending_Processing
ON dbo.Products (TenantId, CreatedAt)
INCLUDE (Sku, Title, SourceUrl)
WHERE Status = 'RAW';

-- 3. Índice de Cobertura: Listagem e Paginação de Catálogo no Dashboard
CREATE INDEX IF NOT EXISTS IX_Products_Tenant_Status_CreatedAt
ON dbo.Products (TenantId, Status, CreatedAt DESC)
INCLUDE (Sku, Title, Price, Brand, Category, StockQuantity);

-- 4. Índice de Cobertura para Resolução Rápida de Webhooks Nuvemshop
CREATE INDEX IF NOT EXISTS IX_Products_Tenant_NuvemshopProduct
ON dbo.Products (TenantId, NuvemshopProductId)
INCLUDE (Sku, Title, Price, StockQuantity)
WHERE NuvemshopProductId IS NOT NULL;
