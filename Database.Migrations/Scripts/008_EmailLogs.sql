-- ==============================================================================
-- Script 008: Auditoria e Logs Transacionais de E-mail (Resend) (PostgreSQL 16)
-- E-commerce Bot SaaS
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS dbo;

CREATE TABLE IF NOT EXISTS dbo.EmailLogs (
    Id UUID NOT NULL DEFAULT gen_random_uuid(),
    TenantId UUID NOT NULL,
    ResendId VARCHAR(128) NULL,
    Recipient VARCHAR(255) NOT NULL,
    EventType VARCHAR(64) NOT NULL,
    Status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    Subject VARCHAR(255) NOT NULL,
    IdempotencyKey VARCHAR(256) NULL,
    ErrorMessage TEXT NULL,
    MetadataInfo TEXT NOT NULL DEFAULT '{}',
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UpdatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_EmailLogs PRIMARY KEY (Id)
);

CREATE INDEX IF NOT EXISTS IX_EmailLogs_TenantId_Status 
ON dbo.EmailLogs (TenantId, Status);

CREATE INDEX IF NOT EXISTS IX_EmailLogs_TenantId_EventType 
ON dbo.EmailLogs (TenantId, EventType);

CREATE INDEX IF NOT EXISTS IX_EmailLogs_ResendId 
ON dbo.EmailLogs (ResendId);
