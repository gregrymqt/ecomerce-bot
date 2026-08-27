-- ==============================================================================
-- Script 013: Integrações de Lojas Multi-Tenant (Shopify, Nuvemshop, WooCommerce)
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, UNIQUEIDENTIFIER (NEWSEQUENTIALID())
-- ==============================================================================

-- 1. Tabela: StoreIntegrations (Gestão de Conexões e Credenciais Criptografadas AES-256 GCM)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StoreIntegrations' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.StoreIntegrations (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        Platform NVARCHAR(50) NOT NULL, -- 'SHOPIFY', 'NUVEMSHOP', 'WOOCOMMERCE'
        StoreDomain NVARCHAR(255) NOT NULL, -- ex: "minhaloja.myshopify.com"
        EncryptedAccessToken VARBINARY(MAX) NOT NULL,
        EncryptedClientSecret VARBINARY(MAX) NULL,
        InitializationVector VARBINARY(32) NOT NULL, -- Nonce / IV para AES-256 GCM
        AuthTag VARBINARY(32) NOT NULL, -- Tag de Autenticação GCM
        Status NVARCHAR(30) NOT NULL DEFAULT 'CONNECTED', -- 'CONNECTED', 'DISCONNECTED', 'ERROR'
        HealthCheckStatus NVARCHAR(200) NULL,
        HealthCheckLatencyMs INT NULL,
        LastHealthCheckAt DATETIMEOFFSET NULL,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_StoreIntegrations PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_StoreIntegrations_Tenants FOREIGN KEY (TenantId) 
            REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
        CONSTRAINT UQ_StoreIntegrations_Tenant_Platform_Domain UNIQUE NONCLUSTERED (TenantId, Platform, StoreDomain)
    );
END
GO

-- 2. Índice de Cobertura para Resolução Rápida de Webhooks por Domínio e Plataforma
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_StoreIntegrations_Platform_Domain' AND object_id = OBJECT_ID('dbo.StoreIntegrations'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_StoreIntegrations_Platform_Domain
    ON dbo.StoreIntegrations (Platform, StoreDomain)
    INCLUDE (TenantId, Status, EncryptedAccessToken, InitializationVector, AuthTag);
END
GO

-- 3. Índice para Listagem de Integrações do Tenant no Dashboard
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_StoreIntegrations_Tenant_Status' AND object_id = OBJECT_ID('dbo.StoreIntegrations'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_StoreIntegrations_Tenant_Status
    ON dbo.StoreIntegrations (TenantId, Status)
    INCLUDE (Platform, StoreDomain, HealthCheckStatus, HealthCheckLatencyMs, LastHealthCheckAt);
END
GO

-- 4. Extensão da Tabela Products: Identificadores Nativos da Shopify para Sincronização Bi-direcional
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'ShopifyProductId' AND Object_ID = Object_ID(N'dbo.Products'))
BEGIN
    ALTER TABLE dbo.Products ADD ShopifyProductId NVARCHAR(100) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'ShopifyVariantId' AND Object_ID = Object_ID(N'dbo.Products'))
BEGIN
    ALTER TABLE dbo.Products ADD ShopifyVariantId NVARCHAR(100) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'ShopifyInventoryItemId' AND Object_ID = Object_ID(N'dbo.Products'))
BEGIN
    ALTER TABLE dbo.Products ADD ShopifyInventoryItemId NVARCHAR(100) NULL;
END
GO
