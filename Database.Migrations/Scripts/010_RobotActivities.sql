-- ==============================================================================
-- Script 010: Atividades de Robôs e Workers Assíncronos (RobotActivities)
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, UNIQUEIDENTIFIER (NEWSEQUENTIALID()),
--         DATETIMEOFFSET (SYSDATETIMEOFFSET()) e FKs ON DELETE CASCADE
-- ==============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RobotActivities' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.RobotActivities (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        WorkerType NVARCHAR(100) NOT NULL, -- Ex: ScraperWorker, ProcessorWorker
        Status NVARCHAR(50) NOT NULL,      -- Ex: success, error
        DetailsJson NVARCHAR(MAX) NULL,
        DurationMs INT NULL,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_RobotActivities PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_RobotActivities_Tenants FOREIGN KEY (TenantId)
            REFERENCES dbo.Tenants(Id) ON DELETE CASCADE
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RobotActivities_TenantId_CreatedAt' AND object_id = OBJECT_ID('dbo.RobotActivities'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_RobotActivities_TenantId_CreatedAt 
    ON dbo.RobotActivities (TenantId, CreatedAt DESC)
    INCLUDE (WorkerType, Status, DurationMs);
END
GO
