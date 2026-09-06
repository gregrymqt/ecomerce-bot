using System;
using System.Diagnostics;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Shopify;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Exceptions;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Messaging;

public class ShopifyBulkSyncConsumer : IConsumer<ShopifyBulkSyncMessage>
{
    private readonly IEcommerceGatewayFactory _gatewayFactory;
    private readonly IProductRepository _productRepository;
    private readonly ITenantRepository _tenantRepository;
    private readonly IStoreIntegrationRepository _storeIntegrationRepository;
    private readonly IRobotActivityRepository _robotActivityRepository;
    private readonly IRedisService _redisService;
    private readonly ILogger<ShopifyBulkSyncConsumer> _logger;

    public ShopifyBulkSyncConsumer(
        IEcommerceGatewayFactory gatewayFactory,
        IProductRepository productRepository,
        ITenantRepository tenantRepository,
        IStoreIntegrationRepository storeIntegrationRepository,
        IRobotActivityRepository robotActivityRepository,
        IRedisService redisService,
        ILogger<ShopifyBulkSyncConsumer> logger)
    {
        _gatewayFactory = gatewayFactory;
        _productRepository = productRepository;
        _tenantRepository = tenantRepository;
        _storeIntegrationRepository = storeIntegrationRepository;
        _robotActivityRepository = robotActivityRepository;
        _redisService = redisService;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<ShopifyBulkSyncMessage> context)
    {
        var msg = context.Message;
        _logger.LogInformation("Processing Shopify Bulk Sync for Job {JobId}, SKU '{Sku}', Tenant '{TenantId}'", msg.JobId, msg.Sku, msg.TenantId);

        // 1. Controle de Quotas Atômico: Verifica e deduz 1 crédito por SKU a sincronizar
        try
        {
            await _tenantRepository.DeductCreditsAsync(
                msg.TenantId,
                amount: 1,
                type: "PRODUCT_ENRICHMENT",
                description: $"Sincronização em lote Shopify: SKU {msg.Sku}",
                referenceId: msg.JobId
            );
        }
        catch (InsufficientCreditsException ex)
        {
            _logger.LogWarning("Tenant {TenantId} com créditos insuficientes ({Current}) para sincronizar SKU '{Sku}' no Job {JobId}. Pausando sincronização.",
                msg.TenantId, ex.CurrentBalance, msg.Sku, msg.JobId);

            // Atualiza status da integração para 'paused_insufficient_credits'
            await _storeIntegrationRepository.UpdateStatusAsync(msg.TenantId, "Shopify", "paused_insufficient_credits");

            // Emite evento SSE no Redis alertando sobre créditos esgotados
            var pauseSseEvent = new
            {
                type = "SYNC_PAUSED_INSUFFICIENT_CREDITS",
                platform = "Shopify",
                job_id = msg.JobId,
                sku = msg.Sku,
                status = "PAUSED_INSUFFICIENT_CREDITS",
                message = "Sincronização pausada: saldo de créditos esgotado. Recarregue para continuar.",
                current_balance = ex.CurrentBalance,
                required_credits = ex.RequiredCredits,
                timestamp = DateTimeOffset.UtcNow
            };
            await _redisService.PublishAsync($"events:tenant:{msg.TenantId}", JsonSerializer.Serialize(pauseSseEvent));

            // Retorna sem lançar exceção para evitar DLQ desnecessária
            return;
        }

        var sw = Stopwatch.StartNew();
        var product = await _productRepository.GetBySkuAsync(msg.TenantId, msg.Sku);
        if (product == null)
        {
            _logger.LogWarning("Product with SKU '{Sku}' not found for Tenant '{TenantId}'", msg.Sku, msg.TenantId);
            // Estorna crédito deduzido pois produto não existe
            await _tenantRepository.AddCreditsAsync(
                msg.TenantId,
                amount: 1,
                type: "REFUND",
                description: $"Estorno por produto não encontrado para Shopify (SKU: {msg.Sku})",
                referenceId: msg.JobId
            );
            return;
        }

        var shopifyGateway = _gatewayFactory.GetGateway("Shopify");
        var success = await shopifyGateway.PushProductAsync(msg.TenantId, product);
        sw.Stop();

        // 2. Registra na tabela RobotActivities
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

        // 3. Publica evento no Redis Pub/Sub para streaming SSE em tempo real no Frontend
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
            _logger.LogWarning("Failed to sync SKU '{Sku}' to Shopify in Job {JobId}. Estornando 1 crédito.", msg.Sku, msg.JobId);
            await _tenantRepository.AddCreditsAsync(
                msg.TenantId,
                amount: 1,
                type: "REFUND",
                description: $"Estorno automático por falha no envio para Shopify (SKU: {msg.Sku})",
                referenceId: msg.JobId
            );
            return;
        }

        _logger.LogInformation("Successfully synced SKU '{Sku}' to Shopify for Job {JobId}", msg.Sku, msg.JobId);
    }
}
