using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Diagnostics.Mcp.Protocol;
using EcommerceBot.Infrastructure.Options;
using Microsoft.Extensions.Options;

namespace EcommerceBot.Diagnostics.Mcp.Tools;

/// <summary>
/// Ferramenta de inspeção de profundidade de filas e Dead Letter Queues (DLQs) no RabbitMQ 3.13.
/// Consulta a RabbitMQ Management API (HTTP 15672) ou valida conectividade TCP no broker (AMQP 5672).
/// Totalmente Read-Only e com suporte a cancelamento cooperativo.
/// </summary>
public sealed class RabbitMqQueueTool : ISystemDiagnosticTool
{
    private readonly RabbitMqOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;

    private static readonly string[] CriticalQueues =
    [
        "queue:ecommerce",
        "queue:analytics_ml",
        "ecommerce_processed_queue",
        "email_notifications",
        "nuvemshop_bulk_sync",
        "queue:ecommerce_error",
        "analytics_ml_error"
    ];

    public RabbitMqQueueTool(IOptions<RabbitMqOptions> options, IHttpClientFactory httpClientFactory)
    {
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
    }

    public string Name => "inspect_rabbitmq_queues";

    public string Description => "Inspeciona o backlog de mensagens, consumidores ativos e taxas nas filas críticas e DLQs do RabbitMQ.";

    public object InputSchema => new
    {
        type = "object",
        properties = new
        {
            queueName = new
            {
                type = "string",
                description = "Nome de uma fila específica para inspecionar. Se omitido, inspeciona todas as filas canônicas."
            }
        }
    };

    public async Task<McpToolCallResult> ExecuteAsync(JsonElement? arguments, CancellationToken cancellationToken = default)
    {
        string? targetQueue = null;
        if (arguments.HasValue && arguments.Value.TryGetProperty("queueName", out var qProp))
        {
            targetQueue = qProp.GetString();
        }

        var queuesToCheck = string.IsNullOrWhiteSpace(targetQueue)
            ? CriticalQueues
            : [targetQueue];

        try
        {
            // Consulta via RabbitMQ Management API reutilizando HttpClient configurado
            var httpClient = _httpClientFactory.CreateClient("RabbitMqManagement");
            var authBytes = Encoding.ASCII.GetBytes($"{_options.Username}:{_options.Password}");
            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));

            var queueReports = new List<object>();
            bool managementApiAvailable = true;

            foreach (var q in queuesToCheck)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var encodedVhost = Uri.EscapeDataString(_options.VirtualHost);
                var encodedQueue = Uri.EscapeDataString(q);
                var managementUrl = $"http://{_options.Host}:15672/api/queues/{encodedVhost}/{encodedQueue}";

                try
                {
                    using var response = await httpClient.GetAsync(managementUrl, cancellationToken);
                    if (response.IsSuccessStatusCode)
                    {
                        var json = await response.Content.ReadAsStringAsync(cancellationToken);
                        using var doc = JsonDocument.Parse(json);
                        var root = doc.RootElement;

                        long messages = root.TryGetProperty("messages", out var m) ? m.GetInt64() : 0;
                        long ready = root.TryGetProperty("messages_ready", out var mr) ? mr.GetInt64() : 0;
                        long unacked = root.TryGetProperty("messages_unacknowledged", out var mu) ? mu.GetInt64() : 0;
                        int consumers = root.TryGetProperty("consumers", out var c) ? c.GetInt32() : 0;

                        queueReports.Add(new
                        {
                            queue = q,
                            status = messages > 1000 ? "WARNING_BACKLOG" : (q.EndsWith("_error") && messages > 0 ? "WARNING_DEAD_LETTERS" : "HEALTHY"),
                            totalMessages = messages,
                            readyMessages = ready,
                            unacknowledgedMessages = unacked,
                            activeConsumers = consumers
                        });
                    }
                    else if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                    {
                        queueReports.Add(new
                        {
                            queue = q,
                            status = "QUEUE_NOT_YET_DECLARED",
                            notice = "A fila ainda não recebeu tráfego ou não foi declarada pelo MassTransit/Worker."
                        });
                    }
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    throw;
                }
                catch
                {
                    managementApiAvailable = false;
                    break;
                }
            }

            if (managementApiAvailable && queueReports.Count > 0)
            {
                var report = new
                {
                    host = _options.Host,
                    virtualHost = _options.VirtualHost,
                    managementApi = "CONNECTED",
                    queues = queueReports
                };

                return new McpToolCallResult
                {
                    IsError = false,
                    Content =
                    [
                        new()
                        {
                            Type = "text",
                            Text = JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true })
                        }
                    ]
                };
            }

            // Fallback: Teste de conectividade TCP na porta AMQP 5672
            using var tcpClient = new TcpClient();
            var connectTask = tcpClient.ConnectAsync(_options.Host, _options.Port, cancellationToken).AsTask();
            var completedTask = await Task.WhenAny(connectTask, Task.Delay(2000, cancellationToken));

            bool tcpConnected = completedTask == connectTask && tcpClient.Connected;

            var fallbackReport = new
            {
                host = _options.Host,
                amqpPort = _options.Port,
                tcpConnected,
                managementApi = "UNAVAILABLE_OR_PORT_CLOSED",
                notice = tcpConnected
                    ? $"Broker AMQP em {_options.Host}:{_options.Port} está online. A API de Management HTTP (porta 15672) não respondeu."
                    : $"Não foi possível conectar ao RabbitMQ em {_options.Host}:{_options.Port} via TCP."
            };

            return new McpToolCallResult
            {
                IsError = !tcpConnected,
                Content =
                [
                    new()
                    {
                        Type = "text",
                        Text = JsonSerializer.Serialize(fallbackReport, new JsonSerializerOptions { WriteIndented = true })
                    }
                ]
            };
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return new McpToolCallResult
            {
                IsError = true,
                Content =
                [
                    new()
                    {
                        Type = "text",
                        Text = "Operação de inspeção do RabbitMQ cancelada."
                    }
                ]
            };
        }
        catch (Exception ex)
        {
            return new McpToolCallResult
            {
                IsError = true,
                Content =
                [
                    new()
                    {
                        Type = "text",
                        Text = $"Erro ao inspecionar RabbitMQ: {ex.Message}"
                    }
                ]
            };
        }
    }
}
