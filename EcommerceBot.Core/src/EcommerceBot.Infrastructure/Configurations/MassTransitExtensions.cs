using System;
using EcommerceBot.Infrastructure.Messaging;
using MassTransit;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EcommerceBot.Infrastructure.Configurations;

/// <summary>
/// Configuração do MassTransit e RabbitMQ para mensageria assíncrona entre .NET e Python Workers.
/// </summary>
public static class MassTransitExtensions
{
    public static IServiceCollection AddMessagingInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddMassTransit(x =>
        {
            // Registra os Consumers de eventos
            x.AddConsumer<ProcessedProductConsumer>();
            x.AddConsumer<EmailNotificationConsumer>();
            x.AddConsumer<NuvemshopBulkSyncConsumer>();

            x.UsingRabbitMq((context, cfg) =>
            {
                cfg.UseRawJsonSerializer();

                var rabbitMqHost = configuration["RabbitMQ:Host"] ?? "localhost";
                var rabbitMqUser = configuration["RabbitMQ:Username"] ?? "guest";
                var rabbitMqPass = configuration["RabbitMQ:Password"] ?? "guest";

                cfg.Host(rabbitMqHost, "/", h =>
                {
                    h.Username(rabbitMqUser);
                    h.Password(rabbitMqPass);
                });

                // Endpoints de fila
                cfg.ReceiveEndpoint("ecommerce_processed_queue", e =>
                {
                    e.ConfigureConsumer<ProcessedProductConsumer>(context);
                });

                cfg.ReceiveEndpoint("email_notifications", e =>
                {
                    e.ConfigureConsumer<EmailNotificationConsumer>(context);
                });

                cfg.ReceiveEndpoint("nuvemshop_bulk_sync", e =>
                {
                    e.ConfigureConsumer<NuvemshopBulkSyncConsumer>(context);
                });
            });
        });

        return services;
    }
}
