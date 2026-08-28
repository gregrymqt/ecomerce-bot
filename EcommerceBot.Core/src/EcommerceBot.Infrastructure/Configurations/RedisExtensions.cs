using System;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Infrastructure.Options;
using EcommerceBot.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace EcommerceBot.Infrastructure.Configurations;

/// <summary>
/// Configuração do StackExchange.Redis e do serviço padrão IRedisService.
/// </summary>
public static class RedisExtensions
{
    public static IServiceCollection AddRedisInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<IConnectionMultiplexer>(sp =>
        {
            var dbOptions = sp.GetRequiredService<IOptions<DatabaseOptions>>().Value;
            var redisOptions = sp.GetRequiredService<IOptions<RedisOptions>>().Value;

            var connectionString = !string.IsNullOrWhiteSpace(redisOptions.ConnectionString) && redisOptions.ConnectionString != "localhost:6379,abortConnect=false"
                ? redisOptions.ConnectionString
                : (!string.IsNullOrWhiteSpace(dbOptions.Redis) ? dbOptions.Redis : "localhost:6379,abortConnect=false");

            return ConnectionMultiplexer.Connect(connectionString);
        });

        services.AddSingleton<IRedisService, RedisService>();

        return services;
    }
}
