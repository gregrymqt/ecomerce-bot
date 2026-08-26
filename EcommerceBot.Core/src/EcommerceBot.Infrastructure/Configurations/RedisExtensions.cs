using System;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;

namespace EcommerceBot.Infrastructure.Configurations;

/// <summary>
/// Configuração do StackExchange.Redis e do serviço padrão IRedisService.
/// </summary>
public static class RedisExtensions
{
    public static IServiceCollection AddRedisInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var redisConnectionString = configuration.GetConnectionString("Redis") ?? "localhost:6379";

        services.AddSingleton<IConnectionMultiplexer>(sp =>
            ConnectionMultiplexer.Connect(redisConnectionString));

        services.AddSingleton<IRedisService, RedisService>();

        return services;
    }
}
