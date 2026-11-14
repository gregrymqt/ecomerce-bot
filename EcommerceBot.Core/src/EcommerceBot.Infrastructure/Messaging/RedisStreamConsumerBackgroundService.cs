using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace EcommerceBot.Infrastructure.Messaging;

/// <summary>
/// Hosted Service base para consumo resiliente de mensagens de Redis Streams via Consumer Groups (XREADGROUP).
/// </summary>
public abstract class RedisStreamConsumerBackgroundService<TMessage, TConsumer> : BackgroundService
    where TMessage : class
    where TConsumer : IConsumer<TMessage>
{
    private readonly IConnectionMultiplexer _redis;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger _logger;
    private readonly string _streamName;
    private readonly string _groupName;
    private readonly string _consumerName;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    protected RedisStreamConsumerBackgroundService(
        IConnectionMultiplexer redis,
        IServiceProvider serviceProvider,
        ILogger logger,
        string streamName,
        string groupName)
    {
        _redis = redis ?? throw new ArgumentNullException(nameof(redis));
        _serviceProvider = serviceProvider ?? throw new ArgumentNullException(nameof(serviceProvider));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _streamName = streamName;
        _groupName = groupName;
        _consumerName = $"{groupName}-{Environment.MachineName}-{Guid.NewGuid().ToString("N")[..6]}";
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var db = _redis.GetDatabase();

        // 1. Assegura criação idempotente do Stream e do Consumer Group (XGROUP CREATE ... MKSTREAM)
        await EnsureConsumerGroupCreatedAsync(db);

        _logger.LogInformation("Consumer {Consumer} iniciado escutando stream '{Stream}' grupo '{Group}'.",
            _consumerName, _streamName, _groupName);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // 2. Lê novas mensagens atribuídas a este consumidor no grupo
                var messages = await db.StreamReadGroupAsync(
                    _streamName,
                    _groupName,
                    _consumerName,
                    position: StreamPosition.NewMessages,
                    count: 2,
                    noAck: false);

                if (messages == null || messages.Length == 0)
                {
                    await Task.Delay(150, stoppingToken);
                    continue;
                }

                foreach (var streamEntry in messages)
                {
                    await ProcessSingleEntryAsync(db, streamEntry, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Erro transitório no loop do stream '{Stream}'. Tentando novamente em 3s...", _streamName);
                await Task.Delay(3000, stoppingToken);
            }
        }

        _logger.LogInformation("Consumer {Consumer} encerrado graciosamente.", _consumerName);
    }

    private async Task EnsureConsumerGroupCreatedAsync(IDatabase db)
    {
        try
        {
            await db.StreamCreateConsumerGroupAsync(_streamName, _groupName, StreamPosition.Beginning, createStream: true);
            _logger.LogInformation("Consumer Group '{Group}' criado para o stream '{Stream}'.", _groupName, _streamName);
        }
        catch (RedisServerException ex) when (ex.Message.Contains("BUSYGROUP", StringComparison.OrdinalIgnoreCase))
        {
            // Grupo já existe, esperado em múltiplos nós ou restarts
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Aviso ao verificar Consumer Group '{Group}' no stream '{Stream}': {Message}",
                _groupName, _streamName, ex.Message);
        }
    }

    private async Task ProcessSingleEntryAsync(IDatabase db, StreamEntry entry, CancellationToken stoppingToken)
    {
        string? payloadJson = null;
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var field in entry.Values)
        {
            if (field.Name == "payload")
            {
                payloadJson = field.Value;
            }
            else if (field.Name.ToString().StartsWith("header_"))
            {
                var headerKey = field.Name.ToString().Substring(7);
                headers[headerKey] = field.Value.ToString();
            }
        }

        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            // Mensagem malformada ou vazia, reconhece para evitar trava
            await db.StreamAcknowledgeAsync(_streamName, _groupName, entry.Id);
            return;
        }

        TMessage? message = null;
        try
        {
            message = JsonSerializer.Deserialize<TMessage>(payloadJson, JsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha na desserialização da mensagem {Id} no stream '{Stream}'. Despachando para DLQ.", entry.Id, _streamName);
            await RouteToDlqAsync(db, entry, ex.Message);
            await db.StreamAcknowledgeAsync(_streamName, _groupName, entry.Id);
            return;
        }

        if (message == null)
        {
            await db.StreamAcknowledgeAsync(_streamName, _groupName, entry.Id);
            return;
        }

        // Executa dentro de escopo de injeção de dependência próprio
        using var scope = _serviceProvider.CreateScope();
        var consumer = scope.ServiceProvider.GetRequiredService<TConsumer>();

        var context = new DefaultConsumeContext<TMessage>(message, entry.Id.ToString(), stoppingToken, headers);

        try
        {
            await consumer.Consume(context);
            // Confirmação (ACK) somente após processamento sem erros
            await db.StreamAcknowledgeAsync(_streamName, _groupName, entry.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro no processamento da mensagem {Id} pelo consumer {Consumer}. Encaminhando para DLQ.",
                entry.Id, typeof(TConsumer).Name);

            await RouteToDlqAsync(db, entry, ex.ToString());
            await db.StreamAcknowledgeAsync(_streamName, _groupName, entry.Id);
        }
    }

    private async Task RouteToDlqAsync(IDatabase db, StreamEntry entry, string reason)
    {
        try
        {
            var dlqEntries = new List<NameValueEntry>
            {
                new("originalStream", _streamName),
                new("originalId", entry.Id.ToString()),
                new("failedConsumer", typeof(TConsumer).Name),
                new("failureReason", reason),
                new("failedAt", DateTimeOffset.UtcNow.ToString("O"))
            };

            foreach (var v in entry.Values)
            {
                dlqEntries.Add(v);
            }

            await db.StreamAddAsync(RedisStreamNames.DlqEcommerce, dlqEntries.ToArray());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha crítica ao publicar na DLQ do Redis ({Stream}): {Message}", RedisStreamNames.DlqEcommerce, ex.Message);
        }
    }
}
