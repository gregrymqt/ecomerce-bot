-- ==============================================================================
-- Script 016: Diagnóstico Operacional Avançado (Deadlocks, Waits e Version Store)
-- E-commerce Bot SaaS
-- Padrão: Idempotente com CREATE OR ALTER VIEW
-- Diretriz: Skill sqlserver-dba (Lote 1: Concorrência, RCSI & Observabilidade)
-- ==============================================================================

-- 1. View: Captura de Deadlocks Recentes via Ring Buffer do Extended Event (system_health)
CREATE OR ALTER VIEW dbo.vw_Monitor_Deadlocks AS
SELECT 
    XEvent.value('(event/@timestamp)[1]', 'DATETIMEOFFSET') AS DeadlockTime,
    XEvent.query('(event/data[@name="xml_report"]/value/deadlock)[1]') AS DeadlockGraph
FROM (
    SELECT CAST(target_data AS XML) AS TargetData
    FROM sys.dm_xe_session_targets st
    INNER JOIN sys.dm_xe_sessions s ON s.address = st.event_session_address
    WHERE s.name = 'system_health' AND st.target_name = 'ring_buffer'
) AS Data
CROSS APPLY TargetData.nodes('RingBufferTarget/event[@name="xml_deadlock_report"]') AS XEventData(XEvent);
GO

-- 2. View: Identificação dos Principais Tipos de Espera (Gargalos de CPU, I/O, Lock e Rede)
CREATE OR ALTER VIEW dbo.vw_Monitor_WaitStats AS
SELECT TOP 25
    wait_type AS WaitType,
    waiting_tasks_count AS WaitingTasksCount,
    CAST(wait_time_ms / 1000.0 AS DECIMAL(12, 2)) AS WaitTimeSeconds,
    CAST((wait_time_ms - signal_wait_time_ms) / 1000.0 AS DECIMAL(12, 2)) AS ResourceWaitSeconds,
    CAST(signal_wait_time_ms / 1000.0 AS DECIMAL(12, 2)) AS SignalWaitSeconds,
    CAST(
        CASE WHEN wait_time_ms > 0 
             THEN 100.0 * signal_wait_time_ms / wait_time_ms 
             ELSE 0 
        END AS DECIMAL(5, 2)
    ) AS SignalPercentage
FROM sys.dm_os_wait_stats
WHERE wait_type NOT IN (
    'CLR_SEMAPHORE','LAZYWRITER_SLEEP','RESOURCE_QUEUE','SLEEP_TASK',
    'SLEEP_SYSTEMTASK','SQLTRACE_BUFFER_FLUSH','WAITFOR','HADR_FILESTREAM_IOMREQUEST',
    'DIRTY_PAGE_POLL','DISPATCHER_QUEUE_SEMAPHORE','FT_IFTS_SCHEDULER_IDLE_WAIT',
    'XE_TIMER_EVENT','XE_DISPATCHER_WAIT','CHECKPOINT_QUEUE','BROKER_TASK_STOP',
    'BROKER_TO_FLUSH','BROKER_RECEIVE_WAITFOR','PREEMPTIVE_OS_AUTHENTICATIONOPS',
    'QDS_PERSIST_TASK_MAIN_LOOP_SLEEP','QDS_ASYNC_QUEUE','QDS_CLEANUP_STALE_QUERIES_TASK_MAIN_LOOP_SLEEP'
)
ORDER BY wait_time_ms DESC;
GO

-- 3. View: Monitoramento de Consumo do Version Store no tempdb (RCSI / Snapshot Isolation)
CREATE OR ALTER VIEW dbo.vw_Monitor_VersionStore AS
SELECT 
    DB_NAME(database_id) AS DatabaseName,
    reserved_page_count AS ReservedPageCount,
    reserved_space_kb AS ReservedSpaceKb,
    CAST(reserved_space_kb / 1024.0 AS DECIMAL(10, 2)) AS ReservedSpaceMB
FROM sys.dm_tran_version_store_space_usage;
GO

-- 4. View: Transações Ativas sob Snapshot Isolation (Identificação de Transações Longas)
CREATE OR ALTER VIEW dbo.vw_Monitor_ActiveSnapshotTransactions AS
SELECT 
    ast.transaction_id AS TransactionId,
    ast.transaction_sequence_num AS SequenceNum,
    ast.commit_sequence_num AS CommitSequenceNum,
    ast.is_snapshot AS IsSnapshot,
    ast.session_id AS SessionId,
    ast.first_snapshot_sequence_num AS FirstSnapshotSeqNum,
    ast.max_version_chain_traversed AS MaxVersionChainTraversed,
    ast.elapsed_time_seconds AS ElapsedTimeSeconds,
    s.login_name AS LoginName,
    s.host_name AS HostName,
    s.program_name AS ProgramName
FROM sys.dm_tran_active_snapshot_database_transactions ast
LEFT JOIN sys.dm_exec_sessions s ON ast.session_id = s.session_id;
GO
