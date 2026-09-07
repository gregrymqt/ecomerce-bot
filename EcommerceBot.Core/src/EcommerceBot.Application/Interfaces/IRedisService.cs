using System;
using System.Threading;
using System.Threading.Tasks;

namespace EcommerceBot.Application.Interfaces;

/// <summary>
/// Contrato unificado para operações de cache, incremento, idempotência e mensageria Pub/Sub no Redis.
/// Implementa proteção contra Cache Stampede (Double-Checked Locking) e Jitter aleatório no TTL.
/// </summary>
public interface IRedisService
{
    /// <summary>
    /// Obtém um objeto desserializado a partir de uma chave no Redis.
    /// </summary>
    Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default);

    /// <summary>
    /// Armazena um objeto serializado em JSON no Redis com TTL opcional e Jitter de até 10% para evitar expiração sincronizada.
    /// </summary>
    Task<bool> SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Incrementa atomicamente um contador numérico no Redis.
    /// </summary>
    Task<long> IncrementAsync(string key, long value = 1, TimeSpan? expiry = null);

    /// <summary>
    /// Obtém um valor do cache ou executa uma factory assíncrona para computar e armazenar o valor se ausente.
    /// Implementa Double-Checked Locking para mitigar Cache Stampede e adiciona Jitter ao TTL.
    /// </summary>
    Task<T?> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan? expiry = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Remove uma chave do Redis.
    /// </summary>
    Task<bool> RemoveAsync(string key, CancellationToken cancellationToken = default);

    /// <summary>
    /// Verifica se uma chave existe no Redis.
    /// </summary>
    Task<bool> KeyExistsAsync(string key, CancellationToken cancellationToken = default);

    /// <summary>
    /// Grava uma chave atomicamente apenas se ela NÃO existir (SET NX), ideal para idempotência de webhooks.
    /// </summary>
    Task<bool> SetIfNotExistsAsync(string key, string value, TimeSpan expiry, CancellationToken cancellationToken = default);

    /// <summary>
    /// Publica uma mensagem em um canal do Redis Pub/Sub.
    /// </summary>
    Task<long> PublishAsync(string channel, string message);

    /// <summary>
    /// Inscreve um handler em um canal do Redis Pub/Sub.
    /// </summary>
    Task SubscribeAsync(string channel, Func<string, Task> handler);

    /// <summary>
    /// Cancela a inscrição em um canal do Redis Pub/Sub.
    /// </summary>
    Task UnsubscribeAsync(string channel);
}
