-- ==============================================================================
-- Script 016: Diagnóstico Operacional Avançado (Locks, Waits e Transações) (PostgreSQL 16)
-- E-commerce Bot SaaS
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS dbo;

-- 1. View: Identificação de Processos Bloqueados / Deadlocks em Potencial
CREATE OR REPLACE VIEW dbo.vw_Monitor_Deadlocks AS
SELECT 
    blocked_locks.pid AS BlockedPid,
    blocked_activity.usename AS BlockedUser,
    blocking_locks.pid AS BlockingPid,
    blocking_activity.usename AS BlockingUser,
    blocked_activity.query AS BlockedStatement,
    blocking_activity.query AS CurrentStatementInBlockingProcess
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- 2. View: Identificação dos Principais Tipos de Espera (Wait Events)
CREATE OR REPLACE VIEW dbo.vw_Monitor_WaitStats AS
SELECT 
    wait_event_type AS WaitType,
    wait_event AS WaitEvent,
    COUNT(*) AS WaitingTasksCount,
    state AS State
FROM pg_stat_activity
WHERE wait_event IS NOT NULL
GROUP BY wait_event_type, wait_event, state
ORDER BY WaitingTasksCount DESC;

-- 3. View: Monitoramento de Tamanho da Base
CREATE OR REPLACE VIEW dbo.vw_Monitor_VersionStore AS
SELECT 
    current_database() AS DatabaseName,
    pg_database_size(current_database()) / (1024 * 1024) AS DatabaseSizeMB;

-- 4. View: Transações Ativas Longas
CREATE OR REPLACE VIEW dbo.vw_Monitor_ActiveSnapshotTransactions AS
SELECT 
    pid AS SessionId,
    usename AS LoginName,
    client_addr::text AS HostName,
    application_name AS ProgramName,
    ROUND((EXTRACT(EPOCH FROM (NOW() - xact_start)))::numeric, 2) AS ElapsedTimeSeconds,
    state AS State,
    query AS QueryText
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY ElapsedTimeSeconds DESC;
