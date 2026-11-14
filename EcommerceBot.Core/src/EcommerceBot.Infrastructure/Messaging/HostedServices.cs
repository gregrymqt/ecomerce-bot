using System;
using EcommerceBot.Application.DTOs.Emails;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Application.DTOs.Nuvemshop;
using EcommerceBot.Application.DTOs.Shopify;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace EcommerceBot.Infrastructure.Messaging;

public sealed class ScrapedProductStreamHostedService 
    : RedisStreamConsumerBackgroundService<ScrapedRawProductEvent, ScrapedProductConsumer>
{
    public ScrapedProductStreamHostedService(
        IConnectionMultiplexer redis,
        IServiceProvider serviceProvider,
        ILogger<ScrapedProductStreamHostedService> logger)
        : base(redis, serviceProvider, logger, RedisStreamNames.ScrapedResults, RedisStreamNames.GroupApiScraped)
    {
    }
}

public sealed class EmailNotificationStreamHostedService 
    : RedisStreamConsumerBackgroundService<EmailEventPayload, EmailNotificationConsumer>
{
    public EmailNotificationStreamHostedService(
        IConnectionMultiplexer redis,
        IServiceProvider serviceProvider,
        ILogger<EmailNotificationStreamHostedService> logger)
        : base(redis, serviceProvider, logger, RedisStreamNames.EmailNotifications, RedisStreamNames.GroupApiEmail)
    {
    }
}

public sealed class NuvemshopBulkSyncStreamHostedService 
    : RedisStreamConsumerBackgroundService<NuvemshopBulkSyncMessage, NuvemshopBulkSyncConsumer>
{
    public NuvemshopBulkSyncStreamHostedService(
        IConnectionMultiplexer redis,
        IServiceProvider serviceProvider,
        ILogger<NuvemshopBulkSyncStreamHostedService> logger)
        : base(redis, serviceProvider, logger, RedisStreamNames.NuvemshopBulkSync, RedisStreamNames.GroupApiNuvemshop)
    {
    }
}

public sealed class ShopifyBulkSyncStreamHostedService 
    : RedisStreamConsumerBackgroundService<ShopifyBulkSyncMessage, ShopifyBulkSyncConsumer>
{
    public ShopifyBulkSyncStreamHostedService(
        IConnectionMultiplexer redis,
        IServiceProvider serviceProvider,
        ILogger<ShopifyBulkSyncStreamHostedService> logger)
        : base(redis, serviceProvider, logger, RedisStreamNames.ShopifyBulkSync, RedisStreamNames.GroupApiShopify)
    {
    }
}

public sealed class AnalyticsProcessedStreamHostedService 
    : RedisStreamConsumerBackgroundService<MlAnalysisResultMessage, AnalyticsProcessedConsumer>
{
    public AnalyticsProcessedStreamHostedService(
        IConnectionMultiplexer redis,
        IServiceProvider serviceProvider,
        ILogger<AnalyticsProcessedStreamHostedService> logger)
        : base(redis, serviceProvider, logger, RedisStreamNames.AnalyticsProcessed, RedisStreamNames.GroupApiAnalytics)
    {
    }
}

public sealed class PaymentProcessingStreamHostedService 
    : RedisStreamConsumerBackgroundService<PaymentReceivedEvent, PaymentProcessingConsumer>
{
    public PaymentProcessingStreamHostedService(
        IConnectionMultiplexer redis,
        IServiceProvider serviceProvider,
        ILogger<PaymentProcessingStreamHostedService> logger)
        : base(redis, serviceProvider, logger, RedisStreamNames.PaymentsProcess, RedisStreamNames.GroupApiPayments)
    {
    }
}
