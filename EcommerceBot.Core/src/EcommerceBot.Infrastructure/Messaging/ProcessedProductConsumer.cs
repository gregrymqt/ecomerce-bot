using System;
using System.Text.Json;
using System.Threading.Tasks;
using MassTransit;
using StackExchange.Redis;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Messaging;

public class ProcessedProductConsumer : IConsumer<ProductProcessedEvent>
{
    private readonly IProductRepository _productRepository;
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<ProcessedProductConsumer> _logger;

    public ProcessedProductConsumer(
        IProductRepository productRepository, 
        IConnectionMultiplexer redis,
        ILogger<ProcessedProductConsumer> logger)
    {
        _productRepository = productRepository;
        _redis = redis;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<ProductProcessedEvent> context)
    {
        var message = context.Message;
        _logger.LogInformation("Recebido ProductProcessedEvent para Tenant {TenantId}, SKU {Sku}. Status: {Status}", 
            message.TenantId, message.Sku, message.Status);

        // Update no banco de dados via Dapper
        await _productRepository.UpdateStatusAsync(
            tenantId: message.TenantId,
            sku: message.Sku,
            status: message.Status,
            metadata: message.AiMetadataJson
        );
        
        // Notificar o Frontend em tempo real via SSE (Redis Pub/Sub)
        var subscriber = _redis.GetSubscriber();
        var channel = new RedisChannel($"events:tenant:{message.TenantId}", RedisChannel.PatternMode.Literal);
        
        var payload = JsonSerializer.Serialize(new {
            type = "product_processed",
            sku = message.Sku,
            status = message.Status
        });

        await subscriber.PublishAsync(channel, payload);
    }
}
