using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Diagnostics.Mcp.Protocol;
using StackExchange.Redis;

namespace EcommerceBot.Diagnostics.Mcp.Tools;

/// <summary>
/// Ferramenta de diagnóstico de saúde, latência e memória do Redis 7.
/// Totalmente Read-Only (proibido FLUSH ou DEL).
/// </summary>
public class RedisMetricsTool : ISystemDiagnosticTool
{
    private readonly IConnectionMultiplexer _redis;

    public RedisMetricsTool(IConnectionMultiplexer redis)
    {
        _redis = redis;
    }

    public string Name => "check_redis_metrics";

    public string Description => "Inspeciona o estado do Redis: conectividade, latência de ping, uso de memória, número de clientes conectados e status de cluster/standalone.";

    public object InputSchema => new
    {
        type = "object",
        properties = new { }
    };

    public async Task<McpToolCallResult> ExecuteAsync(JsonElement? arguments)
    {
        try
        {
            var db = _redis.GetDatabase();
            var endpoints = _redis.GetEndPoints();

            if (endpoints.Length == 0)
            {
                return new McpToolCallResult
                {
                    IsError = true,
                    Content = new List<McpContentItem>
                    {
                        new() { Type = "text", Text = "Nenhum endpoint Redis configurado ou disponível." }
                    }
                };
            }

            var server = _redis.GetServer(endpoints[0]);
            var pingLatency = await db.PingAsync();

            string usedMemoryHuman = "N/A";
            string connectedClients = "N/A";
            string redisVersion = "N/A";

            try
            {
                var info = await server.InfoAsync();
                foreach (var group in info)
                {
                    foreach (var item in group)
                    {
                        if (item.Key.Equals("used_memory_human", StringComparison.OrdinalIgnoreCase))
                            usedMemoryHuman = item.Value;
                        if (item.Key.Equals("connected_clients", StringComparison.OrdinalIgnoreCase))
                            connectedClients = item.Value;
                        if (item.Key.Equals("redis_version", StringComparison.OrdinalIgnoreCase))
                            redisVersion = item.Value;
                    }
                }
            }
            catch
            {
                // Em alguns ambientes gerenciados/proxies, INFO pode ser restrito
            }

            var report = new
            {
                status = _redis.IsConnected ? "CONNECTED" : "DISCONNECTED",
                pingLatencyMs = Math.Round(pingLatency.TotalMilliseconds, 2),
                redisVersion = redisVersion,
                usedMemory = usedMemoryHuman,
                connectedClients = connectedClients,
                endpointsCount = endpoints.Length
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
                        Text = $"Erro ao obter métricas do Redis: {ex.Message}"
                    }
                }
            };
        }
    }
}
