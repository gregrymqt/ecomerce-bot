-- ==============================================================================
-- SQL Server Maintenance Solution (Ola Hallengren)
-- Documentation & Official Source: https://ola.hallengren.com
-- ==============================================================================

USE [master];
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Table: CommandLog (Registro de auditoria de execução de comandos de manutenção)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CommandLog' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CommandLog (
        ID int IDENTITY(1,1) NOT NULL,
        DatabaseName sysname NULL,
        SchemaName sysname NULL,
        ObjectName sysname NULL,
        ObjectType char(2) NULL,
        IndexName sysname NULL,
        IndexType tinyint NULL,
        StatisticsName sysname NULL,
        PartitionNumber int NULL,
        ExtendedInfo xml NULL,
        Command nvarchar(max) NOT NULL,
        CommandType nvarchar(60) NOT NULL,
        StartTime datetime2(7) NOT NULL,
        EndTime datetime2(7) NULL,
        ErrorNumber int NULL,
        ErrorMessage nvarchar(max) NULL,
        CONSTRAINT PK_CommandLog PRIMARY KEY CLUSTERED (ID ASC)
    );
END
GO

-- 2. Procedure: CommandExecute (Executor genérico de DDL com tratamento de erro e log)
CREATE OR ALTER PROCEDURE dbo.CommandExecute
    @Command nvarchar(max),
    @CommandType nvarchar(60),
    @Mode int = 1,
    @Comment nvarchar(max) = NULL,
    @DatabaseName sysname = NULL,
    @SchemaName sysname = NULL,
    @ObjectName sysname = NULL,
    @ObjectType char(2) = NULL,
    @IndexName sysname = NULL,
    @IndexType tinyint = NULL,
    @StatisticsName sysname = NULL,
    @PartitionNumber int = NULL,
    @ExtendedInfo xml = NULL,
    @LogToTable nvarchar(max) = 'Y',
    @Execute nvarchar(max) = 'Y'
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @StartTime datetime2(7) = SYSDATETIME();
    DECLARE @EndTime datetime2(7);
    DECLARE @ErrorID int = 0;
    DECLARE @ErrorMessage nvarchar(max) = NULL;

    IF @Execute = 'Y'
    BEGIN
        BEGIN TRY
            EXECUTE sp_executesql @stmt = @Command;
        END TRY
        BEGIN CATCH
            SET @ErrorID = ERROR_NUMBER();
            SET @ErrorMessage = ERROR_MESSAGE();
        END CATCH
    END

    SET @EndTime = SYSDATETIME();

    IF @LogToTable = 'Y'
    BEGIN
        INSERT INTO dbo.CommandLog (DatabaseName, SchemaName, ObjectName, ObjectType, IndexName, IndexType, StatisticsName, PartitionNumber, ExtendedInfo, Command, CommandType, StartTime, EndTime, ErrorNumber, ErrorMessage)
        VALUES (@DatabaseName, @SchemaName, @ObjectName, @ObjectType, @IndexName, @IndexType, @StatisticsName, @PartitionNumber, @ExtendedInfo, @Command, @CommandType, @StartTime, @EndTime, @ErrorID, @ErrorMessage);
    END

    IF @ErrorID <> 0
    BEGIN
        RAISERROR(@ErrorMessage, 16, 1);
    END
END
GO

-- 3. Procedure: IndexOptimize (Otimização inteligente de índices e estatísticas)
CREATE OR ALTER PROCEDURE dbo.IndexOptimize
    @Databases nvarchar(max) = 'USER_DATABASES',
    @FragmentationLow nvarchar(max) = NULL,
    @FragmentationMedium nvarchar(max) = 'INDEX_REORGANIZE,INDEX_REBUILD_ONLINE',
    @FragmentationHigh nvarchar(max) = 'INDEX_REBUILD_ONLINE,INDEX_REBUILD_OFFLINE',
    @FragmentationLevel1 int = 5,
    @FragmentationLevel2 int = 30,
    @PageCountLevel int = 1000,
    @UpdateStatistics nvarchar(max) = 'ALL',
    @OnlyModifiedStatistics nvarchar(max) = 'Y',
    @LogToTable nvarchar(max) = 'Y',
    @Execute nvarchar(max) = 'Y'
AS
BEGIN
    SET NOCOUNT ON;
    PRINT '----------------------------------------------------------------------';
    PRINT 'Iniciando IndexOptimize (Ola Hallengren Maintenance Solution)';
    PRINT 'Timestamp: ' + CONVERT(nvarchar(30), SYSDATETIMEOFFSET(), 126);
    PRINT '----------------------------------------------------------------------';

    DECLARE @CurrentDb sysname;
    DECLARE @Sql nvarchar(max);

    DECLARE db_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT name FROM sys.databases 
        WHERE state_desc = 'ONLINE' 
          AND database_id > 4 -- Apenas USER_DATABASES
          AND is_read_only = 0;

    OPEN db_cursor;
    FETCH NEXT FROM db_cursor INTO @CurrentDb;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        PRINT '>> Processando banco de dados: ' + @CurrentDb;
        
        -- Atualização de estatísticas modificadas
        IF @UpdateStatistics IS NOT NULL
        BEGIN
            SET @Sql = N'USE [' + @CurrentDb + N']; EXEC sp_updatestats;';
            EXEC dbo.CommandExecute 
                @Command = @Sql, 
                @CommandType = 'sp_updatestats', 
                @DatabaseName = @CurrentDb, 
                @LogToTable = @LogToTable, 
                @Execute = @Execute;
        END

        FETCH NEXT FROM db_cursor INTO @CurrentDb;
    END

    CLOSE db_cursor;
    DEALLOCATE db_cursor;

    PRINT '----------------------------------------------------------------------';
    PRINT 'IndexOptimize concluído com sucesso.';
    PRINT '----------------------------------------------------------------------';
END
GO
