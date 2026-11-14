using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace EcommerceBot.Infrastructure.Messaging;

/// <summary>
/// Publicador determinístico de mensagens e eventos em Redis Streams via StackExchange.Redis.
/// Suporta resolução inteligente de streams e mapeamento transparente de rotas.
/// </summary>
public sealed class RedisStreamPublisher : IStreamPublisher, IPublishEndpoint, ISendEndpointProvider
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<RedisStreamPublisher> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public RedisStreamPublisher(
        IConnectionMultiplexer redis,
        ILogger<RedisStreamPublisher> logger)
    {
        _redis = redis ?? throw new ArgumentNullException(nameof(redis));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<string> PublishAsync<T>(
        string streamName,
        T message,
        IDictionary<string, string>? headers = null,
        CancellationToken cancellationToken = default)
    {
        if (message == null) throw new ArgumentNullException(nameof(message));

        var db = _redis.GetDatabase();
        var targetStream = RedisStreamNames.ResolveStream(streamName, typeof(T));

        var jsonPayload = JsonSerializer.Serialize(message, JsonOptions);
        var entries = new List<NameValueEntry>
        {
            new("payload", jsonPayload),
            new("messageType", typeof(T).FullName ?? typeof(T).Name),
            new("timestamp", DateTimeOffset.UtcNow.ToString("O"))
        };

        if (headers != null)
        {
            foreach (var kvp in headers)
            {
                if (!string.IsNullOrWhiteSpace(kvp.Key) && kvp.Value != null)
                {
                    entries.Add(new($"header_{kvp.Key}", kvp.Value));
                }
            }
        }

        var messageId = await db.StreamAddAsync(targetStream, entries.ToArray());
        _logger.LogDebug("Mensagem {Type} adicionada ao stream '{Stream}' com ID {Id}", typeof(T).Name, targetStream, messageId);

        return messageId.ToString();
    }

    // --- Implementação IPublishEndpoint ---

    public Task Publish<T>(T message, CancellationToken cancellationToken = default) where T : class
    {
        var targetStream = RedisStreamNames.ResolveStream(null, typeof(T));
        return PublishAsync(targetStream, message, null, cancellationToken);
    }

    public Task Publish<T>(T message, Action<PublishContext<T>> callback, CancellationToken cancellationToken = default) where T : class
    {
        var context = new PublishContext<T>(message);
        callback?.Invoke(context);

        var targetStream = RedisStreamNames.ResolveStream(context.RoutingKey, typeof(T));
        return PublishAsync(targetStream, message, context.Headers, cancellationToken);
    }

    public Task Publish<T>(T message, Action<PublishContext> callback, CancellationToken cancellationToken = default) where T : class
    {
        var context = new PublishContext();
        callback?.Invoke(context);

        var targetStream = RedisStreamNames.ResolveStream(context.RoutingKey, typeof(T));
        return PublishAsync(targetStream, message, context.Headers, cancellationToken);
    }

    // --- Implementação ISendEndpointProvider ---

    public Task<ISendEndpoint> GetSendEndpoint(Uri address)
    {
        var streamName = RedisStreamNames.ResolveStream(address.AbsolutePath.TrimStart('/'));
        ISendEndpoint endpoint = new RedisStreamSendEndpoint(this, streamName);
        return Task.FromResult(endpoint);
    }

    private sealed class RedisStreamSendEndpoint : ISendEndpoint
    {
        private readonly RedisStreamPublisher _publisher;
        private readonly string _streamName;

        public RedisStreamSendEndpoint(RedisStreamPublisher publisher, string streamName)
        {
            _publisher = publisher;
            _streamName = streamName;
        }

        public Task Send<T>(T message, CancellationToken cancellationToken = default) where T : class
        {
            return _publisher.PublishAsync(_streamName, message, null, cancellationToken);
        }

        public Task Send<T>(T message, Action<SendContext<T>> callback, CancellationToken cancellationToken = default) where T : class
        {
            var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var context = new SendContext<T>(message, headers);
            callback?.Invoke(context);

            return _publisher.PublishAsync(_streamName, message, headers, cancellationToken);
        }
    }
}
