# 🗄️ Runbook: Diagnóstico de SQL Server 2022 via DMVs

Este runbook orienta agentes de IA e engenheiros no diagnóstico de lentidão, bloqueios e contenção no Microsoft SQL Server 2022 do **E-commerce Bot**, respeitando estritamente o isolamento multi-tenant e a ausência de locks adicionais em produção.

---

## ⛔ Regra de Ouro (Read-Only)
- **NUNCA** execute comandos de alteração de dados (`UPDATE`, `DELETE`, `DROP`, `TRUNCATE`) durante investigações de diagnóstico.
- **SEMPRE** utilize `WITH (NOLOCK)` em consultas a tabelas de catálogo ou metadados para evitar agravar contenções ativas.
- Utilize exclusivamente as DMVs (*Dynamic Management Views*) do SQL Server.

---

## 🔍 1. Investigação de Bloqueios e Locks Ativos

Se requisições na API Core estiverem sofrendo timeout ou latência elevada:

```sql
SELECT 
    r.session_id AS SessionId,
    r.status AS Status,
    r.blocking_session_id AS BlockingSessionId,
    r.wait_type AS WaitType,
    r.wait_time AS WaitTimeMs,
    r.cpu_time AS CpuTimeMs,
    r.total_elapsed_time AS TotalElapsedTimeMs,
    SUBSTRING(t.text, (r.statement_start_offset/2)+1,
        (((CASE r.statement_end_offset
            WHEN -1 THEN DATALENGTH(t.text)
            ELSE r.statement_end_offset
        END - r.statement_start_offset)/2) + 1)) AS StatementText
FROM sys.dm_exec_requests r WITH (NOLOCK)
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.session_id != @@SPID
  AND (r.blocking_session_id != 0 OR r.wait_time > 1000);
```

### O que observar:
- `BlockingSessionId`: Identifica qual conexão está segurando a transação raiz.
- `WaitType`: Tipos comuns como `LCK_M_X` (lock exclusivo) ou `LCK_M_U` (lock de update).
- Se `BlockingSessionId` persistir por mais de 30 segundos, investigue se há transação aberta não comitada (`BEGIN TRAN` sem `COMMIT`/`ROLLBACK`).

---

## 🐢 2. Top 5 Queries Mais Lentas por Tempo Médio de CPU

Para identificar consultas com necessidade de índices de cobertura (`INCLUDE`) ou que estejam sofrendo Key Lookups:

```sql
SELECT TOP 5
    qs.execution_count AS ExecutionCount,
    (qs.total_worker_time / qs.execution_count) / 1000 AS AvgCpuMs,
    (qs.total_elapsed_time / qs.execution_count) / 1000 AS AvgDurationMs,
    qs.total_logical_reads / qs.execution_count AS AvgLogicalReads,
    SUBSTRING(st.text, (qs.statement_start_offset/2)+1,
        (((CASE qs.statement_end_offset
            WHEN -1 THEN DATALENGTH(st.text)
            ELSE qs.statement_end_offset
        END - qs.statement_start_offset)/2) + 1)) AS QueryText
FROM sys.dm_exec_query_stats qs WITH (NOLOCK)
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
ORDER BY (qs.total_worker_time / qs.execution_count) DESC;
```

### O que observar:
- `AvgLogicalReads` muito alto (> 50.000 páginas) indica **Table Scan** ou ausência de índice em colunas de filtro (`TenantId`, `CreatedAt`, `Status`).
- Verifique se a query está aplicando o filtro de multi-tenant `WHERE TenantId = @TenantId`.

---

## 📈 3. Checagem de Conexões e Pools

Para checar se o pool do ADO.NET / Dapper na API Core está estourando:

```sql
SELECT 
    DB_NAME(dbid) AS DatabaseName,
    COUNT(dbid) AS NumberOfConnections,
    loginame AS LoginName,
    status AS Status
FROM sys.sysprocesses WITH (NOLOCK)
WHERE dbid = DB_ID('EcommerceBotDb')
GROUP BY dbid, loginame, status;
```

---

## 🛠️ Procedimento de Remediação Segura
1. **Identificou Deadlock?** Colete o XML de Deadlock Graph gerado no Extended Events (`system_health`).
2. **Falta de Índice?** Crie um novo script versionado de migração em `Database.Migrations/Scripts/` (ex: `012_add_index_orders_tenant_created.sql`).
3. **Nunca aplique DDL diretamente no banco de produção sem passar pelo DbUp.**
