-- ==============================================================================
-- Script 024: Tenant Billing Profiles & Order Address Snapshot
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, UNIQUEIDENTIFIER (NEWSEQUENTIALID()),
--         DATETIMEOFFSET (SYSDATETIMEOFFSET()), Índices de Cobertura e FKs ON DELETE CASCADE
-- ==============================================================================

-- 1. Criação da tabela 1:1 dbo.TenantBillingProfiles
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TenantBillingProfiles' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.TenantBillingProfiles (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        LegalName NVARCHAR(255) NOT NULL,
        TradeName NVARCHAR(255) NULL,
        DocumentType NVARCHAR(10) NOT NULL DEFAULT 'CPF', -- 'CPF' ou 'CNPJ'
        DocumentNumber NVARCHAR(30) NOT NULL,            -- Sanitizado (apenas números)
        Email NVARCHAR(255) NULL,
        Phone NVARCHAR(50) NULL,
        ZipCode NVARCHAR(20) NOT NULL,                   -- CEP
        StreetName NVARCHAR(255) NOT NULL,               -- Logradouro
        StreetNumber NVARCHAR(50) NOT NULL,              -- Número
        Complement NVARCHAR(150) NULL,                   -- Complemento
        Neighborhood NVARCHAR(150) NOT NULL,             -- Bairro
        City NVARCHAR(150) NOT NULL,                     -- Cidade
        FederalUnit NVARCHAR(10) NOT NULL,               -- UF (ex: SP)
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),

        CONSTRAINT PK_TenantBillingProfiles PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_TenantBillingProfiles_Tenants FOREIGN KEY (TenantId)
            REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
        CONSTRAINT UQ_TenantBillingProfiles_TenantId UNIQUE (TenantId)
    );

    -- Índice de cobertura para leitura ultrarrápida do perfil de faturamento pelo TenantId
    CREATE NONCLUSTERED INDEX IX_TenantBillingProfiles_TenantId_Covering
    ON dbo.TenantBillingProfiles (TenantId)
    INCLUDE (LegalName, DocumentType, DocumentNumber, ZipCode, StreetName, StreetNumber, Neighborhood, City, FederalUnit, Email, Phone);
END
GO

-- 2. Snapshot de Pagador e Endereço na tabela dbo.Orders
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'PayerName' AND object_id = OBJECT_ID('dbo.Orders'))
BEGIN
    ALTER TABLE dbo.Orders ADD PayerName NVARCHAR(255) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'PayerZipCode' AND object_id = OBJECT_ID('dbo.Orders'))
BEGIN
    ALTER TABLE dbo.Orders ADD PayerZipCode NVARCHAR(20) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'PayerStreetName' AND object_id = OBJECT_ID('dbo.Orders'))
BEGIN
    ALTER TABLE dbo.Orders ADD PayerStreetName NVARCHAR(255) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'PayerStreetNumber' AND object_id = OBJECT_ID('dbo.Orders'))
BEGIN
    ALTER TABLE dbo.Orders ADD PayerStreetNumber NVARCHAR(50) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'PayerComplement' AND object_id = OBJECT_ID('dbo.Orders'))
BEGIN
    ALTER TABLE dbo.Orders ADD PayerComplement NVARCHAR(150) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'PayerNeighborhood' AND object_id = OBJECT_ID('dbo.Orders'))
BEGIN
    ALTER TABLE dbo.Orders ADD PayerNeighborhood NVARCHAR(150) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'PayerCity' AND object_id = OBJECT_ID('dbo.Orders'))
BEGIN
    ALTER TABLE dbo.Orders ADD PayerCity NVARCHAR(150) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'PayerFederalUnit' AND object_id = OBJECT_ID('dbo.Orders'))
BEGIN
    ALTER TABLE dbo.Orders ADD PayerFederalUnit NVARCHAR(10) NULL;
END
GO
