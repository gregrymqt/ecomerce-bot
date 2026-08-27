using System;
using System.Diagnostics;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Nuvemshop;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Messaging;

public class NuvemshopBulkSyncConsumer : IConsumer<NuvemshopBulkSyncMessage>
{
    private readonly IEcommerceGatewayFactory _gatewayFactory;
    private readonly IProductRepository _productRepository;
    private readonly IRobotActivityRepository _robotActivityRepository;
    private readonly IRedisService _redisService;
    private readonly ILogger<NuvemshopBulkSyncConsumer> _logger;

    public NuvemshopBulkSyncConsumer(
        IEcommerceGatewayFactory gatewayFactory,
        IProductRepository productRepository,
        IRobotActivityRepository robotActivityRepository,
        IRedisService redisService,
        ILogger<NuvemshopBulkSyncConsumer> logger)
    {
        _gatewayFactory = gatewayFactory;
        _productRepository = productRepository;
        _robotActivityRepository = robotActivityRepository;
        _redisService = redisService;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<NuvemshopBulkSyncMessage> context)
    {
        var msg = context.Message;
        _logger.LogInformation("Processing Nuvemshop sync for Job {JobId} Sku {Sku} Tenant {TenantId}", msg.JobId, msg.Sku, msg.TenantId);

        var sw = Stopwatch.StartNew();
        var product = await _productRepository.GetBySkuAsync(msg.TenantId, msg.Sku);
        if (product == null)
        {
            _logger.LogWarning("Product {Sku} not found for Tenant {TenantId}", msg.Sku, msg.TenantId);
            return;
        }

        var nuvemshopGateway = _gatewayFactory.GetGateway("Nuvemshop");
        if (nuvemshopGateway == null)
        {
            _logger.LogError("NuvemshopGateway not found");
            return;
        }

        var success = await nuvemshopGateway.PushProductAsync(msg.TenantId, product);
        sw.Stop();

        // 1. Registra telemetria de atividade do robô
        var activity = new RobotActivity
        {
            Id = Guid.NewGuid(),
            TenantId = msg.TenantId,
            WorkerType = "NuvemshopBulkSyncWorker",
            Status = success ? "success" : "error",
            DurationMs = (int)sw.ElapsedMilliseconds,
            DetailsJson = JsonSerializer.Serialize(new
            {
                job_id = msg.JobId,
                sku = msg.Sku,
                nuvemshop_product_id = product.NuvemshopProductId,
                nuvemshop_variant_id = product.NuvemshopVariantId
            }),
            CreatedAt = DateTimeOffset.UtcNow
        };
        await _robotActivityRepository.CreateAsync(activity);

        // 2. Publica evento no Redis Pub/Sub para streaming SSE em tempo real no Frontend
        var sseEvent = new
        {
            type = "NUVEMSHOP_SYNC_PROGRESS",
            job_id = msg.JobId,
            sku = msg.Sku,
            status = success ? "SYNCED" : "FAILED",
            nuvemshop_id = product.NuvemshopProductId,
            timestamp = DateTimeOffset.UtcNow
        };
        await _redisService.PublishAsync($"events:tenant:{msg.TenantId}", JsonSerializer.Serialize(sseEvent));

        if (!success)
        {
            _logger.LogWarning("Failed to sync Sku {Sku} for Job {JobId}", msg.Sku, msg.JobId);
            throw new Exception($"Failed to sync SKU {msg.Sku} to Nuvemshop");
        }

        _logger.LogInformation("Successfully synced Sku {Sku} for Job {JobId}", msg.Sku, msg.JobId);
    }
}
