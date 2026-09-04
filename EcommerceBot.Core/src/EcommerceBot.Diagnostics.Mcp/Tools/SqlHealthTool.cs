using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Diagnostics.Mcp.Protocol;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Data.SqlClient;

namespace EcommerceBot.Diagnostics.Mcp.Tools;

/// <summary>
/// Ferramenta de diagnóstico do SQL Server 2022 estritamente Read-Only.
/// Consulta DMVs (sys.dm_*) com WITH (NOLOCK) para identificar locks, bloqueios e queries lentas.
/// </summary>
public class SqlHealthTool : ISystemDiagnosticTool
{
    private readonly IDbConnectionFactory _connectionFactory;

    public SqlHealthTool(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public string Name => "check_sql_health";

    public string Description => "Inspeciona a saúde do SQL Server 2022 via DMVs (sys.dm_*): bloqueios ativos, deadlocks em andamento, conexões e top queries lentas.";

    public object InputSchema => new
    {
        type = "object",
        properties = new
        {
            includeSlowQueries = new
            {
                type = "boolean",
                description = "Se verdadeiro, inclui as top 5 queries com maior consumo de CPU/duração."
            }
        }
    };

    public async Task<McpToolCallResult> ExecuteAsync(JsonElement? arguments)
    {
        bool includeSlowQueries = true;
        if (arguments.HasValue && arguments.Value.TryGetProperty("includeSlowQueries", out var prop))
        {
            includeSlowQueries = prop.GetBoolean();
        }

        try
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();

            // 1. Informações básicas e conexões
            var versionInfo = await connection.QueryFirstOrDefaultAsync<string>(
                "SELECT @@VERSION;"
            );

            var connectionCount = await connection.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM sys.sysprocesses WITH (NOLOCK) WHERE dbid = DB_ID();"
            );

            // 2. Bloqueios ativos (Locks e Blocking Sessions)
            const string blockingSql = @"
                SELECT 
                    r.session_id AS SessionId,
                    r.status AS Status,
                    r.blocking_session_id AS BlockingSessionId,
                    r.wait_type AS WaitType,
                    r.wait_time AS WaitTimeMs
                FROM sys.dm_exec_requests r WITH (NOLOCK)
                WHERE r.session_id != @@SPID 
                  AND (r.blocking_session_id != 0 OR r.wait_time > 1000);";

            var blockingSessions = (await connection.QueryAsync(blockingSql)).ToList();

            // 3. Top queries lentas (se solicitado)
            IEnumerable<dynamic> slowQueries = Enumerable.Empty<dynamic>();
            if (includeSlowQueries)
            {
                const string slowQuerySql = @"
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
                    ORDER BY (qs.total_worker_time / qs.execution_count) DESC;";

                slowQueries = await connection.QueryAsync(slowQuerySql);
            }

            var report = new
            {
                status = blockingSessions.Count > 0 ? "WARNING_BLOCKS_DETECTED" : "HEALTHY",
                database = connection.Database,
                activeConnections = connectionCount,
                blockingSessionsCount = blockingSessions.Count,
                blockingSessions = blockingSessions,
                slowQueries = slowQueries.Select(q => new
                {
                    executionCount = (long)q.ExecutionCount,
                    avgCpuMs = (long)q.AvgCpuMs,
                    avgDurationMs = (long)q.AvgDurationMs,
                    avgLogicalReads = (long)q.AvgLogicalReads,
                    queryText = ((string)(q.QueryText ?? string.Empty)).Trim()
                }),
                serverVersion = versionInfo?.Split('\n').FirstOrDefault()?.Trim()
            };

            return new McpToolCallResult
            {
                IsError = false,
                Content = new List<McpContentItem>
                {
                    new()
                    {
                        Type = "text",
                        Text = JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true })
                    }
                }
            };
        }
        catch (Exception ex)
        {
            return new McpToolCallResult
            {
                IsError = true,
                Content = new List<McpContentItem>
                {
                    new()
                    {
                        Type = "text",
                        Text = $"Erro ao executar diagnóstico do SQL Server: {ex.Message}"
                    }
                }
            };
        }
    }
}
