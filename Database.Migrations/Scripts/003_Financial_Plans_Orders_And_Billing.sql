-- ==============================================================================
-- Script 003: Planos, Pedidos, Itens e Perfil de Faturamento do Tenant
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, UNIQUEIDENTIFIER (NEWSEQUENTIALID()),
--         DATETIMEOFFSET (SYSDATETIMEOFFSET()), Índices de Cobertura e FKs ON DELETE CASCADE
-- ==============================================================================

-- 1. Tabela: Plans (Pacotes de Créditos e Precificação SaaS)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Plans' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Plans (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,
        Price DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        CreditsIncluded INT NOT NULL DEFAULT 0,
        Badge NVARCHAR(50) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_Plans PRIMARY KEY CLUSTERED (Id)
    );
END
GO

-- Seed Idempotente de Pacotes Canônicos de Crédito
IF NOT EXISTS (SELECT 1 FROM dbo.Plans WHERE Name = 'Starter AI')
BEGIN
    INSERT INTO dbo.Plans (Name, Description, Price, CreditsIncluded, Badge, IsActive, CreatedAt, UpdatedAt)
    VALUES ('Starter AI', 'Pacote com 500 créditos avulsos de IA para catálogo e SEO.', 49.00, 500, NULL, 1, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Plans WHERE Name = 'Pro AI')
BEGIN
    INSERT INTO dbo.Plans (Name, Description, Price, CreditsIncluded, Badge, IsActive, CreatedAt, UpdatedAt)
    VALUES ('Pro AI', 'Pacote mais escolhido com 2.000 créditos avulsos de IA para catálogo em escala.', 149.00, 2000, 'Mais Escolhido', 1, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Plans WHERE Name = 'Scale AI')
BEGIN
    INSERT INTO dbo.Plans (Name, Description, Price, CreditsIncluded, Badge, IsActive, CreatedAt, UpdatedAt)
    VALUES ('Scale AI', 'Pacote de alta escala com 6.000 créditos avulsos de IA com melhor custo por crédito.', 399.00, 6000, 'Melhor Custo', 1, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());
END
GO

-- 2. Tabela: Orders (Transações e Pedidos do Checkout Transparente Mercado Pago - PIX e Cartão)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Orders' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Orders (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        UserId UNIQUEIDENTIFIER NULL,
        PlanId UNIQUEIDENTIFIER NULL,
        TotalAmount DECIMAL(18,2) NOT NULL,
        TotalPaidAmount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        Currency NVARCHAR(10) NOT NULL DEFAULT 'BRL',
        Status NVARCHAR(50) NOT NULL DEFAULT 'pending', -- 'approved', 'pending', 'rejected', 'refunded'
        PaymentMethod NVARCHAR(50) NOT NULL, -- 'pix', 'credit_card'
        MpPaymentId NVARCHAR(100) NULL,
        ExternalReference NVARCHAR(150) NULL,
        PayerEmail NVARCHAR(255) NULL,
        PayerDocumentType NVARCHAR(20) NULL,
        PayerDocumentNumber NVARCHAR(30) NULL,
        PayerName NVARCHAR(255) NULL,
        PayerZipCode NVARCHAR(20) NULL,
        PayerStreetName NVARCHAR(255) NULL,
        PayerStreetNumber NVARCHAR(50) NULL,
        PayerComplement NVARCHAR(150) NULL,
        PayerNeighborhood NVARCHAR(150) NULL,
        PayerCity NVARCHAR(150) NULL,
        PayerFederalUnit NVARCHAR(10) NULL,
        PixQrCode NVARCHAR(MAX) NULL,
        PixQrCodeBase64 NVARCHAR(MAX) NULL,
        PixExpirationDate DATETIMEOFFSET NULL,
        TicketUrl NVARCHAR(MAX) NULL,
        CardLastFourDigits NVARCHAR(10) NULL,
        CardBrand NVARCHAR(50) NULL,
        Installments INT NOT NULL DEFAULT 1,
        PaidAt DATETIMEOFFSET NULL,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_Orders PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_Orders_Tenants FOREIGN KEY (TenantId) 
            REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
        CONSTRAINT FK_Orders_Users FOREIGN KEY (UserId) 
            REFERENCES dbo.Users(Id),
        CONSTRAINT FK_Orders_Plans FOREIGN KEY (PlanId) 
            REFERENCES dbo.Plans(Id)
    );
END
GO

-- Índice de Cobertura no Extrato Financeiro e Dashboard
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Orders_Tenant_CreatedAt' AND object_id = OBJECT_ID('dbo.Orders'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Orders_Tenant_CreatedAt
    ON dbo.Orders (TenantId, CreatedAt DESC)
    INCLUDE (TotalAmount, TotalPaidAmount, Status, PaymentMethod, MpPaymentId, PaidAt);
END
GO

-- Índice de Busca por Referência Externa do Gateway
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Orders_ExternalReference' AND object_id = OBJECT_ID('dbo.Orders'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Orders_ExternalReference 
    ON dbo.Orders (ExternalReference);
END
GO

-- 3. Tabela: OrderItems (Itens de Pedido)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'OrderItems' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.OrderItems (
        Id INT IDENTITY(1,1) NOT NULL,
        OrderId UNIQUEIDENTIFIER NOT NULL,
        Title NVARCHAR(150) NOT NULL,
        UnitPrice DECIMAL(18,2) NOT NULL,
        Quantity INT NOT NULL DEFAULT 1,
        ExternalCode NVARCHAR(100) NULL,
        CONSTRAINT PK_OrderItems PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_OrderItems_Orders FOREIGN KEY (OrderId) 
            REFERENCES dbo.Orders(Id) ON DELETE CASCADE
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OrderItems_OrderId' AND object_id = OBJECT_ID('dbo.OrderItems'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_OrderItems_OrderId 
    ON dbo.OrderItems (OrderId);
END
GO

-- 4. Tabela: TenantBillingProfiles (Dados Fiscais CPF/CNPJ e Endereço de Cobrança 1:1 por Tenant)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TenantBillingProfiles' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.TenantBillingProfiles (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        LegalName NVARCHAR(255) NOT NULL,
        TradeName NVARCHAR(255) NULL,
        DocumentType NVARCHAR(10) NOT NULL DEFAULT 'CPF', -- 'CPF' ou 'CNPJ'
        DocumentNumber NVARCHAR(30) NOT NULL,            -- Apenas dígitos
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
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TenantBillingProfiles_TenantId_Covering' AND object_id = OBJECT_ID('dbo.TenantBillingProfiles'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_TenantBillingProfiles_TenantId_Covering
    ON dbo.TenantBillingProfiles (TenantId)
    INCLUDE (LegalName, DocumentType, DocumentNumber, ZipCode, StreetName, StreetNumber, Neighborhood, City, FederalUnit, Email, Phone);
END
GO
