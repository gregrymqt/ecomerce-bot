using System;
using EcommerceBot.Infrastructure.Messaging;
using EcommerceBot.Infrastructure.Options;
using MassTransit;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EcommerceBot.Infrastructure.Configurations;

/// <summary>
/// Configuração do MassTransit e RabbitMQ com políticas de Retry Exponencial, DLQs e consumidores EDA.
/// </summary>
public static class MassTransitExtensions
{
    public static IServiceCollection AddMessagingInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddMassTransit(x =>
        {
            // 1. Registra os Consumers de eventos
            x.AddConsumer<ProcessedProductConsumer>();
            x.AddConsumer<EmailNotificationConsumer>();
            x.AddConsumer<NuvemshopBulkSyncConsumer>();
            x.AddConsumer<ShopifyBulkSyncConsumer>();
            x.AddConsumer<LlmUsageConsumer>();
            x.AddConsumer<AnalyticsProcessedConsumer>();
            x.AddConsumer<PaymentProcessingConsumer>();

            x.UsingRabbitMq((context, cfg) =>
            {
                cfg.UseRawJsonSerializer();

                var rabbitMqOptions = configuration.GetSection(RabbitMqOptions.SectionName).Get<RabbitMqOptions>() ?? new RabbitMqOptions();

                cfg.Host(rabbitMqOptions.Host, rabbitMqOptions.VirtualHost, h =>
                {
                    h.Username(rabbitMqOptions.Username);
                    h.Password(rabbitMqOptions.Password);
                });

                // Configuração global de Retry com Backoff Exponencial para resiliência
                cfg.UseMessageRetry(r => r.Exponential(
                    retryLimit: 3,
                    minInterval: TimeSpan.FromSeconds(2),
                    maxInterval: TimeSpan.FromSeconds(30),
                    intervalDelta: TimeSpan.FromSeconds(5)
                ));

                // 2. Endpoints de fila de Scraping e IA
                cfg.ReceiveEndpoint("ecommerce_processed_queue", e =>
                {
                    e.ConfigureConsumer<ProcessedProductConsumer>(context);
                });

                cfg.ReceiveEndpoint("llm_usage_queue", e =>
                {
                    e.ConfigureConsumer<LlmUsageConsumer>(context);
                });

                // 3. Endpoints de Notificações e Integrações
                cfg.ReceiveEndpoint("email_notifications", e =>
                {
                    e.ConfigureConsumer<EmailNotificationConsumer>(context);
                });

                cfg.ReceiveEndpoint("nuvemshop_bulk_sync", e =>
                {
                    e.ConfigureConsumer<NuvemshopBulkSyncConsumer>(context);
                });

                cfg.ReceiveEndpoint("shopify_bulk_sync", e =>
                {
                    e.ConfigureConsumer<ShopifyBulkSyncConsumer>(context);
                });

                // 4. Endpoints de Machine Learning e Financeiro
                cfg.ReceiveEndpoint("analytics_processed_queue", e =>
                {
                    e.ConfigureConsumer<AnalyticsProcessedConsumer>(context);
                });

                cfg.ReceiveEndpoint("payments_process_queue", e =>
                {
                    e.ConfigureConsumer<PaymentProcessingConsumer>(context);
                });
            });
        });

        return services;
    }
}
