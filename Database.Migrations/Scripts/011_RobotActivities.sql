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
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT [PK_RobotActivities] PRIMARY KEY CLUSTERED ([Id] ASC)
    );

    CREATE NONCLUSTERED INDEX [IX_RobotActivities_TenantId_CreatedAt] 
    ON [dbo].[RobotActivities]([TenantId], [CreatedAt] DESC);
END
GO
