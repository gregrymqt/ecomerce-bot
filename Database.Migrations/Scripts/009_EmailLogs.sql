-- ==============================================================================
-- Script 009: Email Logs
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS
-- ==============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmailLogs' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.EmailLogs (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        ResendId NVARCHAR(128) NULL,
        Recipient NVARCHAR(255) NOT NULL,
        EventType NVARCHAR(64) NOT NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT 'PENDING',
        Subject NVARCHAR(255) NOT NULL,
        IdempotencyKey NVARCHAR(256) NULL,
        ErrorMessage NVARCHAR(MAX) NULL,
        MetadataInfo NVARCHAR(MAX) NOT NULL DEFAULT '{}',
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_EmailLogs PRIMARY KEY CLUSTERED (Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmailLogs_TenantId_Status' AND object_id = OBJECT_ID('dbo.EmailLogs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_EmailLogs_TenantId_Status ON dbo.EmailLogs (TenantId, Status);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmailLogs_TenantId_EventType' AND object_id = OBJECT_ID('dbo.EmailLogs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_EmailLogs_TenantId_EventType ON dbo.EmailLogs (TenantId, EventType);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmailLogs_ResendId' AND object_id = OBJECT_ID('dbo.EmailLogs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_EmailLogs_ResendId ON dbo.EmailLogs (ResendId);
END
GO
