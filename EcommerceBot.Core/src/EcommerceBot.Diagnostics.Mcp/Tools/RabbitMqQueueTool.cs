using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Diagnostics.Mcp.Protocol;
using EcommerceBot.Infrastructure.Messaging;
using StackExchange.Redis;

namespace EcommerceBot.Diagnostics.Mcp.Tools;

/// <summary>
/// Ferramenta de inspeção de profundidade de streams e Dead Letter Queues (DLQs) no Redis Streams.
/// Totalmente Read-Only e com suporte a cancelamento cooperativo.
/// </summary>
public sealed class RabbitMqQueueTool : ISystemDiagnosticTool
{
    private readonly IConnectionMultiplexer? _redis;

    private static readonly string[] CriticalStreams =
    [
        RedisStreamNames.ScrapingProd,
        RedisStreamNames.ScrapingDemo,
        RedisStreamNames.ScrapedResults,
        RedisStreamNames.EmailNotifications,
        RedisStreamNames.PaymentsProcess,
        RedisStreamNames.ShopifyBulkSync,
        RedisStreamNames.NuvemshopBulkSync,
        RedisStreamNames.DlqEcommerce
    ];

    public RabbitMqQueueTool(IConnectionMultiplexer? redis = null)
    {
        _redis = redis;
    }

    public string Name => "inspect_redis_streams";

    public string Description => "Inspeciona o backlog de mensagens, comprimento dos streams e DLQs no Redis Streams.";

    public object InputSchema => new
    {
        type = "object",
        properties = new
        {
            streamName = new
            {
                type = "string",
                description = "Nome de um stream específico para inspecionar. Se omitido, inspeciona todos os streams canônicos."
            }
        }
    };

    public async Task<McpToolCallResult> ExecuteAsync(JsonElement? arguments, CancellationToken cancellationToken = default)
    {
        if (_redis == null)
        {
            return new McpToolCallResult
            {
                IsError = true,
                Content = [new McpContentItem { Text = "Redis não conectado ou serviço indisponível." }]
            };
        }

        var db = _redis.GetDatabase();
        var streamsToInspect = new List<string>();

        if (arguments.HasValue && arguments.Value.TryGetProperty("streamName", out var streamProp) && streamProp.ValueKind == JsonValueKind.String)
        {
            var specificStream = streamProp.GetString();
            if (!string.IsNullOrWhiteSpace(specificStream))
            {
                streamsToInspect.Add(RedisStreamNames.ResolveStream(specificStream));
            }
        }

        if (streamsToInspect.Count == 0)
        {
            streamsToInspect.AddRange(CriticalStreams);
        }

        var results = new List<object>();

        foreach (var stream in streamsToInspect)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                var length = await db.StreamLengthAsync(stream);
                var groupInfoList = new List<object>();

                try
                {
                    var groups = await db.StreamGroupInfoAsync(stream);
                    foreach (var g in groups)
                    {
                        groupInfoList.Add(new
                        {
                            name = g.Name,
                            consumers = g.ConsumerCount,
                            pending = g.PendingMessageCount,
                            lastDeliveredId = g.LastDeliveredId?.ToString() ?? string.Empty
                        });
                    }
                }
                catch
                {
                    // Stream pode não ter consumer group criado ainda
                }

                results.Add(new
                {
                    stream = stream,
                    length = length,
                    groups = groupInfoList
                });
            }
            catch (Exception ex)
            {
                results.Add(new
                {
                    stream = stream,
                    error = ex.Message
                });
            }
        }

        var json = JsonSerializer.Serialize(results, new JsonSerializerOptions { WriteIndented = true });
        return new McpToolCallResult
        {
            Content = [new McpContentItem { Text = json }]
        };
    }
}
