using System;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Infrastructure.Options;
using EcommerceBot.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace EcommerceBot.Infrastructure.Configurations;

public static class RedisExtensions
{
    public static IServiceCollection AddRedisInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<IConnectionMultiplexer>(sp =>
        {
            var dbOptions = sp.GetRequiredService<IOptions<DatabaseOptions>>().Value;
            var redisOptions = sp.GetRequiredService<IOptions<RedisOptions>>().Value;

            var rawConnectionString = !string.IsNullOrWhiteSpace(redisOptions.ConnectionString)
                ? redisOptions.ConnectionString
                : (!string.IsNullOrWhiteSpace(dbOptions.Redis) ? dbOptions.Redis : "localhost:6379");

            // Sanitiza caso venha com schema de URL (ex: redis:// ou rediss://)
            if (rawConnectionString.StartsWith("redis://", StringComparison.OrdinalIgnoreCase))
            {
                rawConnectionString = rawConnectionString.Substring(8);
            }
            else if (rawConnectionString.StartsWith("rediss://", StringComparison.OrdinalIgnoreCase))
            {
                rawConnectionString = rawConnectionString.Substring(9);
            }

            var configOptions = ConfigurationOptions.Parse(rawConnectionString);
            configOptions.AbortOnConnectFail = false;
            
            // Reduzir para falhar rápido em chamadas assíncronas de rate limit sem segurar requisições HTTP
            configOptions.ConnectTimeout = 3000;
            configOptions.SyncTimeout = 2000;
            configOptions.AsyncTimeout = 2000;
            configOptions.KeepAlive = 60;
            configOptions.ReconnectRetryPolicy = new LinearRetry(2000);

            if (!string.IsNullOrWhiteSpace(redisOptions.Password) && string.IsNullOrWhiteSpace(configOptions.Password))
            {
                configOptions.Password = redisOptions.Password;
            }

            return ConnectionMultiplexer.Connect(configOptions);
        });

        services.AddSingleton<IRedisService, RedisService>();

        return services;
    }
}