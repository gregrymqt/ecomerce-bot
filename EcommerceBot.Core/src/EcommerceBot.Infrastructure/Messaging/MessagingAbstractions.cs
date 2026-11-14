using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace EcommerceBot.Infrastructure.Messaging;

/// <summary>
/// Contrato primário para publicação direta em Redis Streams.
/// </summary>
public interface IStreamPublisher
{
    Task<string> PublishAsync<T>(
        string streamName,
        T message,
        IDictionary<string, string>? headers = null,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Contrato de contexto de consumo de mensagens tipadas do Redis Streams (interface compatível com DispatchProxy/Mocks).
/// </summary>
public interface ConsumeContext<out T> where T : class
{
    T Message { get; }
    string MessageId { get; }
    CancellationToken CancellationToken { get; }
    IDictionary<string, string> Headers { get; }
}

/// <summary>
/// Implementação concreta padrão de ConsumeContext para despacho via Redis Streams.
/// </summary>
public sealed class DefaultConsumeContext<T> : ConsumeContext<T> where T : class
{
    public T Message { get; }
    public string MessageId { get; }
    public CancellationToken CancellationToken { get; }
    public IDictionary<string, string> Headers { get; }

    public DefaultConsumeContext(T message, string messageId, CancellationToken cancellationToken, IDictionary<string, string>? headers = null)
    {
        Message = message ?? throw new ArgumentNullException(nameof(message));
        MessageId = messageId ?? Guid.NewGuid().ToString();
        CancellationToken = cancellationToken;
        Headers = headers ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    }
}

/// <summary>
/// Contrato para consumidores assíncronos de eventos do Redis Streams.
/// </summary>
public interface IConsumer<T> where T : class
{
    Task Consume(ConsumeContext<T> context);
}

/// <summary>
/// Contrato para envio direcionado com suporte a routing key / streams.
/// </summary>
public interface ISendEndpoint
{
    Task Send<T>(T message, CancellationToken cancellationToken = default) where T : class;
    Task Send<T>(T message, Action<SendContext<T>> callback, CancellationToken cancellationToken = default) where T : class;
}

/// <summary>
/// Provedor de endpoints de envio direcionado para streams do Redis.
/// </summary>
public interface ISendEndpointProvider
{
    Task<ISendEndpoint> GetSendEndpoint(Uri address);
}

/// <summary>
/// Provedor de publicação de eventos broadcast ou roteados para streams.
/// </summary>
public interface IPublishEndpoint
{
    Task Publish<T>(T message, CancellationToken cancellationToken = default) where T : class;
    Task Publish<T>(T message, Action<PublishContext<T>> callback, CancellationToken cancellationToken = default) where T : class;
    Task Publish<T>(T message, Action<PublishContext> callback, CancellationToken cancellationToken = default) where T : class;
}

public class SendHeaders
{
    private readonly IDictionary<string, string> _headers;

    public SendHeaders(IDictionary<string, string> headers)
    {
        _headers = headers;
    }

    public void Set(string key, string? value)
    {
        if (value != null) _headers[key] = value;
    }
}

public class SendContext<T> where T : class
{
    public T Message { get; }
    public SendHeaders Headers { get; }
    public Guid MessageId { get; set; } = Guid.NewGuid();

    public SendContext(T message, IDictionary<string, string> headers)
    {
        Message = message;
        Headers = new SendHeaders(headers);
    }
}

public class PublishContext
{
    public IDictionary<string, string> Headers { get; } = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    public string? RoutingKey { get; private set; }

    public void SetRoutingKey(string routingKey)
    {
        RoutingKey = routingKey;
    }
}

public class PublishContext<T> : PublishContext where T : class
{
    public T Message { get; }

    public PublishContext(T message)
    {
        Message = message;
    }
}
