using EcommerceBot.Infrastructure.Messaging;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EcommerceBot.Infrastructure.Configurations;

/// <summary>
/// Configuração de mensageria de alta performance baseada em Redis Streams (substituindo MassTransit e RabbitMQ).
/// Registra publishers nativos, adaptadores e consumidores em background com Consumer Groups (XREADGROUP).
/// </summary>
public static class RedisStreamsExtensions
{
    public static IServiceCollection AddMessagingInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // 1. Registra os Consumers no escopo de injeção
        services.AddScoped<ScrapedProductConsumer>();
        services.AddScoped<EmailNotificationConsumer>();
        services.AddScoped<NuvemshopBulkSyncConsumer>();
        services.AddScoped<ShopifyBulkSyncConsumer>();
        services.AddScoped<PaymentProcessingConsumer>();

        // 2. Registra o Publicador Singleton de Redis Streams
        services.AddSingleton<RedisStreamPublisher>();
        services.AddSingleton<IStreamPublisher>(sp => sp.GetRequiredService<RedisStreamPublisher>());
        services.AddSingleton<IPublishEndpoint>(sp => sp.GetRequiredService<RedisStreamPublisher>());
        services.AddSingleton<ISendEndpointProvider>(sp => sp.GetRequiredService<RedisStreamPublisher>());

        // 3. Registra os HostedServices em background vinculados a Consumer Groups
        services.AddHostedService<ScrapedProductStreamHostedService>();
        services.AddHostedService<EmailNotificationStreamHostedService>();
        services.AddHostedService<NuvemshopBulkSyncStreamHostedService>();
        services.AddHostedService<ShopifyBulkSyncStreamHostedService>();
        services.AddHostedService<PaymentProcessingStreamHostedService>();

        return services;
    }
}
