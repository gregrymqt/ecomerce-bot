-- ==============================================================================
-- Script 005: Views Administrativas e Diagnóstico de Performance (PostgreSQL 16)
-- E-commerce Bot SaaS
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS dbo;

-- 1. View: Identificação de Tabelas com Alto Índice de Seq Scans (Candidatas a Índices)
CREATE OR REPLACE VIEW dbo.vw_Monitor_MissingIndexes AS
SELECT 
    schemaname AS SchemaName,
    relname AS TableName,
    seq_scan AS SeqScans,
    seq_tup_read AS SeqTuplesRead,
    idx_scan AS IdxScans,
    idx_tup_fetch AS IdxTuplesFetched,
    CASE WHEN (seq_scan + idx_scan) > 0 
         THEN ROUND((seq_scan::numeric / (seq_scan + idx_scan) * 100), 2)
         ELSE 0.00 END AS PercentSeqScans
FROM pg_stat_user_tables
WHERE seq_scan > 0;

-- 2. View: Top Queries Ativas Mais Lentas e Alto Consumo
CREATE OR REPLACE VIEW dbo.vw_Monitor_TopQueries AS
SELECT 
    pid AS Pid,
    usename AS UserName,
    datname AS DatabaseName,
    query AS QueryText,
    state AS State,
    ROUND((EXTRACT(EPOCH FROM (NOW() - query_start)) * 1000)::numeric, 2) AS DurationMs,
    query_start AS QueryStart
FROM pg_stat_activity
WHERE state <> 'idle' AND query IS NOT NULL
ORDER BY DurationMs DESC
LIMIT 20;

-- 3. View: Monitoramento de Tamanho, Ocupação em MB e Quantidade de Linhas por Tabela
CREATE OR REPLACE VIEW dbo.vw_Monitor_TableSizes AS
SELECT 
    schemaname AS SchemaName,
    relname AS TableName,
    n_live_tup AS TotalRows,
    ROUND((pg_total_relation_size(relid)::numeric / 1024 / 1024), 2) AS TotalSpaceMB,
    ROUND((pg_relation_size(relid)::numeric / 1024 / 1024), 2) AS UsedSpaceMB,
    ROUND(((pg_total_relation_size(relid) - pg_relation_size(relid))::numeric / 1024 / 1024), 2) AS UnusedSpaceMB
FROM pg_stat_user_tables;
