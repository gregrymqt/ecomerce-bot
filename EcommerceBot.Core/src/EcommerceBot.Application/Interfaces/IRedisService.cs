using System;
using System.Threading.Tasks;

namespace EcommerceBot.Application.Interfaces;

/// <summary>
/// Contrato unificado para operações de cache, incremento, idempotência e mensageria Pub/Sub no Redis.
/// </summary>
public interface IRedisService
{
    /// <summary>
    /// Obtém um objeto desserializado a partir de uma chave no Redis.
    /// </summary>
    Task<T?> GetAsync<T>(string key);

    /// <summary>
    /// Armazena um objeto serializado em JSON no Redis com TTL opcional.
    /// </summary>
    Task<bool> SetAsync<T>(string key, T value, TimeSpan? expiry = null);

    /// <summary>
    /// Incrementa atomicamente um contador numérico no Redis.
    /// </summary>
    Task<long> IncrementAsync(string key, long value = 1, TimeSpan? expiry = null);

    /// <summary>
    /// Obtém um valor do cache ou executa uma factory assíncrona para computar e armazenar o valor se ausente.
    /// </summary>
    Task<T?> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan? expiry = null);

    /// <summary>
    /// Remove uma chave do Redis.
    /// </summary>
    Task<bool> RemoveAsync(string key);

    /// <summary>
    /// Verifica se uma chave existe no Redis.
    /// </summary>
    Task<bool> KeyExistsAsync(string key);

    /// <summary>
    /// Grava uma chave atomicamente apenas se ela NÃO existir (SET NX), ideal para idempotência de webhooks.
    /// </summary>
    Task<bool> SetIfNotExistsAsync(string key, string value, TimeSpan expiry);

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
