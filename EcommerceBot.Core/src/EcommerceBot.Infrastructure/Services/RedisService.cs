using System;
using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace EcommerceBot.Infrastructure.Services;

/// <summary>
/// Implementação padronizada de IRedisService encapsulando IConnectionMultiplexer,
/// serialização JSON com System.Text.Json, tratamento resiliente de erros, Pub/Sub,
/// Double-Checked Locking (proteção contra Cache Stampede) e aplicação de Jitter pseudoaleatório no TTL.
/// </summary>
public sealed class RedisService : IRedisService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<RedisService> _logger;
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> _keyedLocks = new();

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    public RedisService(IConnectionMultiplexer redis, ILogger<RedisService> logger)
    {
        _redis = redis ?? throw new ArgumentNullException(nameof(redis));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    private IDatabase GetDb() => _redis.GetDatabase();

    /// <summary>
    /// Aplica uma variação pseudoaleatória (Jitter) de até 10% no TTL para evitar expiração sincronizada de chaves.
    /// </summary>
    private static TimeSpan? ApplyJitter(TimeSpan? expiry)
    {
        if (!expiry.HasValue || expiry.Value <= TimeSpan.Zero)
            return expiry;

        var maxJitterMs = Math.Max(1, (int)(expiry.Value.TotalMilliseconds * 0.10));
        var jitterMs = Random.Shared.Next(0, maxJitterMs);
        return expiry.Value + TimeSpan.FromMilliseconds(jitterMs);
    }

    public async Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(key) || cancellationToken.IsCancellationRequested) return default;

        try
        {
            var value = await GetDb().StringGetAsync(key);
            if (!value.HasValue) return default;

            if (typeof(T) == typeof(string))
            {
                return (T)(object)value.ToString();
            }

            return JsonSerializer.Deserialize<T>(value.ToString(), JsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao obter chave '{Key}' do Redis.", key);
            return default;
        }
    }

    public async Task<bool> SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(key) || cancellationToken.IsCancellationRequested) return false;

        try
        {
            string payload = value is string strVal
                ? strVal
                : JsonSerializer.Serialize(value, JsonOptions);

            var finalExpiry = ApplyJitter(expiry);
            var db = GetDb();

            return finalExpiry.HasValue
                ? await db.StringSetAsync(key, payload, finalExpiry.Value)
                : await db.StringSetAsync(key, payload);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao gravar chave '{Key}' no Redis.", key);
            return false;
        }
    }

    public async Task<long> IncrementAsync(string key, long value = 1, TimeSpan? expiry = null)
    {
        if (string.IsNullOrWhiteSpace(key)) return 0;

        try
        {
            var db = GetDb();
            var result = await db.StringIncrementAsync(key, value);
            if (result == value && expiry.HasValue)
            {
                var finalExpiry = ApplyJitter(expiry);
                await db.KeyExpireAsync(key, finalExpiry);
            }
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao incrementar chave '{Key}' no Redis.", key);
            return 0;
        }
    }

    public async Task<T?> GetOrCreateAsync<T>(
        string key, 
        Func<Task<T>> factory, 
        TimeSpan? expiry = null, 
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(key)) return await factory();
        if (cancellationToken.IsCancellationRequested) return default;

        // 1. Fast path (sem contenção)
        var cached = await GetAsync<T>(key, cancellationToken);
        if (cached != null)
        {
            return cached;
        }

        // 2. Proteção contra Cache Stampede: semáforo local por chave
        var semaphore = _keyedLocks.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
        await semaphore.WaitAsync(cancellationToken);

        try
        {
            // 3. Double-check após obter o lock
            cached = await GetAsync<T>(key, cancellationToken);
            if (cached != null)
            {
                return cached;
            }

            // 4. Executa a factory para buscar no banco e armazena no Redis com Jitter
            var result = await factory();
            if (result != null)
            {
                await SetAsync(key, result, expiry, cancellationToken);
            }

            return result;
        }
        finally
        {
            semaphore.Release();
        }
    }

    public async Task<bool> RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(key) || cancellationToken.IsCancellationRequested) return false;

        try
        {
            return await GetDb().KeyDeleteAsync(key);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao remover chave '{Key}' do Redis.", key);
            return false;
        }
    }

    public async Task<bool> KeyExistsAsync(string key, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(key) || cancellationToken.IsCancellationRequested) return false;

        try
        {
            return await GetDb().KeyExistsAsync(key);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao verificar existência da chave '{Key}' no Redis.", key);
            return false;
        }
    }

    public async Task<bool> SetIfNotExistsAsync(string key, string value, TimeSpan expiry, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(key) || cancellationToken.IsCancellationRequested) return false;

        try
        {
            var finalExpiry = ApplyJitter(expiry) ?? expiry;
            return await GetDb().StringSetAsync(key, value, finalExpiry, When.NotExists);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao gravar chave com SET NX '{Key}' no Redis.", key);
            return false;
        }
    }

    public async Task<long> PublishAsync(string channel, string message)
    {
        if (string.IsNullOrWhiteSpace(channel)) return 0;

        try
        {
            var sub = _redis.GetSubscriber();
            var redisChannel = new RedisChannel(channel, RedisChannel.PatternMode.Literal);
            return await sub.PublishAsync(redisChannel, message);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao publicar no canal Redis '{Channel}'.", channel);
            return 0;
        }
    }

    public async Task SubscribeAsync(string channel, Func<string, Task> handler)
    {
        if (string.IsNullOrWhiteSpace(channel)) return;

        try
        {
            var sub = _redis.GetSubscriber();
            var redisChannel = new RedisChannel(channel, RedisChannel.PatternMode.Literal);
            await sub.SubscribeAsync(redisChannel, async (ch, msg) =>
            {
                if (msg.HasValue)
                {
                    await handler(msg.ToString());
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao se inscrever no canal Redis '{Channel}'.", channel);
        }
    }

    public async Task UnsubscribeAsync(string channel)
    {
        if (string.IsNullOrWhiteSpace(channel)) return;

        try
        {
            var sub = _redis.GetSubscriber();
            var redisChannel = new RedisChannel(channel, RedisChannel.PatternMode.Literal);
            await sub.UnsubscribeAsync(redisChannel);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao cancelar inscrição no canal Redis '{Channel}'.", channel);
        }
    }
}
