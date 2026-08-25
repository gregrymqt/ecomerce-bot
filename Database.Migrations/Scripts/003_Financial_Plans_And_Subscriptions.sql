-- ==============================================================================
-- Script 003: Planos Financeiros, Assinaturas (MP Preapproval) e Pedidos
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, Chaves Estrangeiras e Índices de Cobertura
-- ==============================================================================

-- 1. Tabela: Plans (Planos e Precificação SaaS)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Plans' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Plans (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,
        Price DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        CreditsIncluded INT NOT NULL DEFAULT 0,
        BillingInterval NVARCHAR(20) NOT NULL DEFAULT 'MONTHLY', -- 'MONTHLY', 'YEARLY'
        MpPreapprovalPlanId NVARCHAR(100) NULL, -- ID do plano gerado na API do Mercado Pago
        TrialDays INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_Plans PRIMARY KEY CLUSTERED (Id)
    );
END
GO

-- 2. Tabela: Subscriptions (Assinaturas Recorrentes por Tenant)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Subscriptions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Subscriptions (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        PlanId UNIQUEIDENTIFIER NOT NULL,
        MpPreapprovalId NVARCHAR(100) NULL, -- ID da assinatura no Mercado Pago
        MpPayerId NVARCHAR(100) NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT 'pending', -- 'authorized', 'pending', 'cancelled', 'paused'
        CurrentPeriodStart DATETIMEOFFSET NULL,
        CurrentPeriodEnd DATETIMEOFFSET NULL,
        CancelledAt DATETIMEOFFSET NULL,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_Subscriptions PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_Subscriptions_Tenants FOREIGN KEY (TenantId) 
            REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
        CONSTRAINT FK_Subscriptions_Plans FOREIGN KEY (PlanId) 
            REFERENCES dbo.Plans(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Subscriptions_Tenant_Status' AND object_id = OBJECT_ID('dbo.Subscriptions'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Subscriptions_Tenant_Status
    ON dbo.Subscriptions (TenantId, Status)
    INCLUDE (PlanId, CurrentPeriodStart, CurrentPeriodEnd, MpPreapprovalId);
END
GO

-- 3. Tabela: Orders (Pedidos e Transações de Checkout Transparente - PIX / Cartão)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Orders' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Orders (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        UserId UNIQUEIDENTIFIER NULL,
        PlanId UNIQUEIDENTIFIER NULL,
        TotalAmount DECIMAL(18,2) NOT NULL,
        Currency NVARCHAR(10) NOT NULL DEFAULT 'BRL',
        Status NVARCHAR(50) NOT NULL DEFAULT 'pending', -- 'approved', 'pending', 'rejected', 'refunded'
        PaymentMethod NVARCHAR(50) NOT NULL, -- 'pix', 'credit_card'
        MpPaymentId NVARCHAR(100) NULL,
        PixQrCode NVARCHAR(MAX) NULL,
        PixQrCodeBase64 NVARCHAR(MAX) NULL,
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
    INCLUDE (TotalAmount, Status, PaymentMethod, MpPaymentId, PaidAt);
END
GO
