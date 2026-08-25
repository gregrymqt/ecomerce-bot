-- ==============================================================================
-- Script 008: Checkout & Order Items
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS
-- ==============================================================================

-- 1. Alterar tabela Orders para unificar dados do Checkout
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'ExternalReference' AND Object_ID = Object_ID(N'dbo.Orders'))
BEGIN
    ALTER TABLE dbo.Orders ADD ExternalReference NVARCHAR(150) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'PayerEmail' AND Object_ID = Object_ID(N'dbo.Orders'))
BEGIN
    ALTER TABLE dbo.Orders ADD PayerEmail NVARCHAR(255) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'PayerDocumentType' AND Object_ID = Object_ID(N'dbo.Orders'))
BEGIN
    ALTER TABLE dbo.Orders ADD PayerDocumentType NVARCHAR(20) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'PayerDocumentNumber' AND Object_ID = Object_ID(N'dbo.Orders'))
BEGIN
    ALTER TABLE dbo.Orders ADD PayerDocumentNumber NVARCHAR(30) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'TicketUrl' AND Object_ID = Object_ID(N'dbo.Orders'))
BEGIN
    ALTER TABLE dbo.Orders ADD TicketUrl NVARCHAR(MAX) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'TotalPaidAmount' AND Object_ID = Object_ID(N'dbo.Orders'))
BEGIN
    ALTER TABLE dbo.Orders ADD TotalPaidAmount DECIMAL(18,2) NOT NULL DEFAULT 0.00;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'PixExpirationDate' AND Object_ID = Object_ID(N'dbo.Orders'))
BEGIN
    ALTER TABLE dbo.Orders ADD PixExpirationDate DATETIMEOFFSET NULL;
END
GO

-- Índice
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Orders_ExternalReference' AND object_id = OBJECT_ID('dbo.Orders'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Orders_ExternalReference ON dbo.Orders (ExternalReference);
END
GO

-- 2. Tabela: OrderItems
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
    CREATE NONCLUSTERED INDEX IX_OrderItems_OrderId ON dbo.OrderItems (OrderId);
END
GO
