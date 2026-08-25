-- ==============================================================================
-- Script 005: Views Administrativas e Diagnóstico de Performance (DMVs)
-- E-commerce Bot SaaS
-- Padrão: Idempotente com CREATE OR ALTER VIEW
-- ==============================================================================

-- 1. View: Identificação de Índices Faltantes com Alto Impacto (>50% de ganho estimado)
CREATE OR ALTER VIEW dbo.vw_Monitor_MissingIndexes AS
SELECT 
    mig.index_group_handle AS IndexGroupHandle,
    mid.statement AS TableName,
    mid.equality_columns AS EqualityColumns,
    mid.inequality_columns AS InequalityColumns,
    mid.included_columns AS IncludedColumns,
    migs.user_seeks AS UserSeeks,
    migs.user_scans AS UserScans,
    CAST(migs.avg_user_impact AS DECIMAL(5,2)) AS EstPercentageImprovement,
    CAST(migs.avg_total_user_cost AS DECIMAL(10,2)) AS AvgUserCost,
    (migs.user_seeks + migs.user_scans) * migs.avg_user_impact AS OverallScore
FROM sys.dm_db_missing_index_groups mig
INNER JOIN sys.dm_db_missing_index_group_stats migs 
    ON migs.group_handle = mig.index_group_handle
INNER JOIN sys.dm_db_missing_index_details mid 
    ON mig.index_handle = mid.index_handle
WHERE migs.avg_user_impact > 50;
GO

-- 2. View: Top Queries Mais Lentas e Alto Consumo de CPU
CREATE OR ALTER VIEW dbo.vw_Monitor_TopQueries AS
SELECT TOP 20
    CAST(qs.total_elapsed_time / qs.execution_count / 1000.0 AS DECIMAL(10,2)) AS AvgExecutionTimeMs,
    CAST(qs.total_worker_time / qs.execution_count / 1000.0 AS DECIMAL(10,2)) AS AvgCpuTimeMs,
    qs.execution_count AS ExecutionCount,
    CAST(qs.total_logical_reads / qs.execution_count AS BIGINT) AS AvgLogicalReads,
    SUBSTRING(st.text, (qs.statement_start_offset/2) + 1, 
        ((CASE qs.statement_end_offset WHEN -1 THEN DATALENGTH(st.text) ELSE qs.statement_end_offset END - qs.statement_start_offset)/2) + 1) AS QueryText,
    qs.last_execution_time AS LastExecutionTime
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
ORDER BY AvgExecutionTimeMs DESC;
GO

-- 3. View: Monitoramento de Tamanho, Ocupação em MB e Quantidade de Linhas por Tabela
CREATE OR ALTER VIEW dbo.vw_Monitor_TableSizes AS
SELECT 
    s.name AS SchemaName,
    t.name AS TableName,
    p.rows AS TotalRows,
    CAST(ROUND(((SUM(a.total_pages) * 8) / 1024.00), 2) AS DECIMAL(10, 2)) AS TotalSpaceMB,
    CAST(ROUND(((SUM(a.used_pages) * 8) / 1024.00), 2) AS DECIMAL(10, 2)) AS UsedSpaceMB,
    CAST(ROUND(((SUM(a.total_pages) - SUM(a.used_pages)) * 8 / 1024.00), 2) AS DECIMAL(10, 2)) AS UnusedSpaceMB
FROM sys.tables t
INNER JOIN sys.indexes i ON t.OBJECT_ID = i.object_id
INNER JOIN sys.partitions p ON i.object_id = p.OBJECT_ID AND i.index_id = p.index_id
INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
LEFT OUTER JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE t.is_ms_shipped = 0 AND i.OBJECT_ID > 255
GROUP BY t.Name, s.Name, p.Rows;
GO
