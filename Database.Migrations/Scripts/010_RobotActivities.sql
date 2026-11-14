-- ==============================================================================
-- Script 010: Atividades de Robôs e Workers Assíncronos (RobotActivities) (PostgreSQL 16)
-- E-commerce Bot SaaS
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS dbo;

CREATE TABLE IF NOT EXISTS dbo.RobotActivities (
    Id UUID NOT NULL DEFAULT gen_random_uuid(),
    TenantId UUID NOT NULL,
    WorkerType VARCHAR(100) NOT NULL,
    Status VARCHAR(50) NOT NULL,
    DetailsJson TEXT NULL,
    DurationMs INT NULL,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_RobotActivities PRIMARY KEY (Id),
    CONSTRAINT FK_RobotActivities_Tenants FOREIGN KEY (TenantId)
        REFERENCES dbo.Tenants(Id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS IX_RobotActivities_TenantId_CreatedAt 
ON dbo.RobotActivities (TenantId, CreatedAt DESC)
INCLUDE (WorkerType, Status, DurationMs);
