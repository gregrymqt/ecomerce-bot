-- Script 014: Adiciona colunas e índices para integração com Nuvemshop (Tiendanube API)
-- Permite persistência de IDs remotos gerados após publicação de produtos

IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.Products') AND name = 'NuvemshopProductId'
)
BEGIN
    ALTER TABLE dbo.Products ADD NuvemshopProductId NVARCHAR(100) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.Products') AND name = 'NuvemshopVariantId'
)
BEGIN
    ALTER TABLE dbo.Products ADD NuvemshopVariantId NVARCHAR(100) NULL;
END
GO

-- Índice não-clusterizado de cobertura para busca rápida por ID da Nuvemshop (Webhooks e Syncs)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = N'IX_Products_Tenant_NuvemshopProduct' AND object_id = OBJECT_ID(N'dbo.Products')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_Products_Tenant_NuvemshopProduct
    ON dbo.Products (TenantId, NuvemshopProductId)
    INCLUDE (Sku, Title, Price, StockQuantity)
    WHERE NuvemshopProductId IS NOT NULL;
END
GO
