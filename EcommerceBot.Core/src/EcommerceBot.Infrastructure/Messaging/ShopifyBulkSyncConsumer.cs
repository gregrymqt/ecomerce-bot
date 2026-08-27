using System;
using System.Diagnostics;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Shopify;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Messaging;

public class ShopifyBulkSyncConsumer : IConsumer<ShopifyBulkSyncMessage>
{
    private readonly IEcommerceGatewayFactory _gatewayFactory;
    private readonly IProductRepository _productRepository;
    private readonly IRobotActivityRepository _robotActivityRepository;
    private readonly IRedisService _redisService;
    private readonly ILogger<ShopifyBulkSyncConsumer> _logger;

    public ShopifyBulkSyncConsumer(
        IEcommerceGatewayFactory gatewayFactory,
        IProductRepository productRepository,
        IRobotActivityRepository robotActivityRepository,
        IRedisService redisService,
        ILogger<ShopifyBulkSyncConsumer> logger)
    {
        _gatewayFactory = gatewayFactory;
        _productRepository = productRepository;
        _robotActivityRepository = robotActivityRepository;
        _redisService = redisService;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<ShopifyBulkSyncMessage> context)
    {
        var msg = context.Message;
        _logger.LogInformation("Processing Shopify Bulk Sync for Job {JobId}, SKU '{Sku}', Tenant '{TenantId}'", msg.JobId, msg.Sku, msg.TenantId);

        var sw = Stopwatch.StartNew();
        var product = await _productRepository.GetBySkuAsync(msg.TenantId, msg.Sku);
        if (product == null)
        {
            _logger.LogWarning("Product with SKU '{Sku}' not found for Tenant '{TenantId}'", msg.Sku, msg.TenantId);
            return;
        }

        var shopifyGateway = _gatewayFactory.GetGateway("Shopify");
        var success = await shopifyGateway.PushProductAsync(msg.TenantId, product);
        sw.Stop();

        // 1. Registra na tabela RobotActivities
        var activity = new RobotActivity
        {
            Id = Guid.NewGuid(),
            TenantId = msg.TenantId,
            WorkerType = "ShopifyBulkSyncWorker",
            Status = success ? "success" : "error",
            DurationMs = (int)sw.ElapsedMilliseconds,
            DetailsJson = JsonSerializer.Serialize(new
            {
                job_id = msg.JobId,
                sku = msg.Sku,
                title = product.Title,
                shopify_id = product.ShopifyProductId,
                success = success
            }),
            CreatedAt = DateTimeOffset.UtcNow
        };
        await _robotActivityRepository.CreateAsync(activity);

        // 2. Publica evento no Redis Pub/Sub para streaming SSE em tempo real no Frontend
        var sseEvent = new
        {
            type = "SHOPIFY_SYNC_PROGRESS",
            job_id = msg.JobId,
            sku = msg.Sku,
            status = success ? "SYNCED" : "FAILED",
            shopify_id = product.ShopifyProductId,
            timestamp = DateTimeOffset.UtcNow
        };
        await _redisService.PublishAsync($"events:tenant:{msg.TenantId}", JsonSerializer.Serialize(sseEvent));

        if (!success)
        {
            _logger.LogWarning("Failed to sync SKU '{Sku}' to Shopify in Job {JobId}", msg.Sku, msg.JobId);
            throw new Exception($"Failed to sync SKU {msg.Sku} to Shopify.");
        }

        _logger.LogInformation("Successfully synced SKU '{Sku}' to Shopify for Job {JobId}", msg.Sku, msg.JobId);
    }
}
