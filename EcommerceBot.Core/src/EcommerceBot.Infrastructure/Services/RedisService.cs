using System;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace EcommerceBot.Infrastructure.Services;

/// <summary>
/// Implementação padronizada de IRedisService encapsulando IConnectionMultiplexer,
/// serialização JSON com System.Text.Json, tratamento resiliente de erros e Pub/Sub.
/// </summary>
public class RedisService : IRedisService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<RedisService> _logger;
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

    public async Task<T?> GetAsync<T>(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return default;

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

    public async Task<bool> SetAsync<T>(string key, T value, TimeSpan? expiry = null)
    {
        if (string.IsNullOrWhiteSpace(key)) return false;

        try
        {
            string payload = value is string strVal
                ? strVal
                : JsonSerializer.Serialize(value, JsonOptions);

            var db = GetDb();
            return expiry.HasValue
                ? await db.StringSetAsync(key, payload, expiry.Value)
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
                await db.KeyExpireAsync(key, expiry.Value);
            }
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao incrementar chave '{Key}' no Redis.", key);
            return 0;
        }
    }

    public async Task<T?> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan? expiry = null)
    {
        if (string.IsNullOrWhiteSpace(key)) return await factory();

        var cached = await GetAsync<T>(key);
        if (cached != null)
        {
            return cached;
        }

        var result = await factory();
        if (result != null)
        {
            await SetAsync(key, result, expiry);
        }

        return result;
    }

    public async Task<bool> RemoveAsync(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return false;

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

    public async Task<bool> KeyExistsAsync(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return false;

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

    public async Task<bool> SetIfNotExistsAsync(string key, string value, TimeSpan expiry)
    {
        if (string.IsNullOrWhiteSpace(key)) return false;

        try
        {
            return await GetDb().StringSetAsync(key, value, expiry, When.NotExists);
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
