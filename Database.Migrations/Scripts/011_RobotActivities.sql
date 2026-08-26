-- 011_RobotActivities.sql
-- Tabela para rastrear atividades de robôs e AI Workers (anteriormente em shadow IT no Python)

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RobotActivities]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[RobotActivities] (
        [Id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [WorkerType] NVARCHAR(100) NOT NULL, -- Ex: ScraperWorker, ProcessorWorker
        [Status] NVARCHAR(50) NOT NULL,      -- Ex: success, error
        [DetailsJson] NVARCHAR(MAX) NULL,
        [DurationMs] INT NULL,
        [CreatedAt] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),

        CONSTRAINT [PK_RobotActivities] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_RobotActivities_Tenants] FOREIGN KEY ([TenantId])
            REFERENCES [dbo].[Tenants]([Id]) ON DELETE CASCADE
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RobotActivities_TenantId_CreatedAt' AND object_id = OBJECT_ID('dbo.RobotActivities'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RobotActivities_TenantId_CreatedAt] 
    ON [dbo].[RobotActivities]([TenantId], [CreatedAt] DESC)
    INCLUDE ([WorkerType], [Status], [DurationMs]);
END
GO
