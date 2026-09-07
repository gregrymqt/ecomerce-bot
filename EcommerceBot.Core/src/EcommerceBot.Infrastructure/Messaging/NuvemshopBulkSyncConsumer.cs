using System;
using System.Diagnostics;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Nuvemshop;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Exceptions;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Messaging;

public sealed class NuvemshopBulkSyncConsumer : IConsumer<NuvemshopBulkSyncMessage>
{
    private readonly IEcommerceGatewayFactory _gatewayFactory;
    private readonly IProductRepository _productRepository;
    private readonly ITenantRepository _tenantRepository;
    private readonly IStoreIntegrationRepository _storeIntegrationRepository;
    private readonly IRobotActivityRepository _robotActivityRepository;
    private readonly IRedisService _redisService;
    private readonly ILogger<NuvemshopBulkSyncConsumer> _logger;

    public NuvemshopBulkSyncConsumer(
        IEcommerceGatewayFactory gatewayFactory,
        IProductRepository productRepository,
        ITenantRepository tenantRepository,
        IStoreIntegrationRepository storeIntegrationRepository,
        IRobotActivityRepository robotActivityRepository,
        IRedisService redisService,
        ILogger<NuvemshopBulkSyncConsumer> logger)
    {
        _gatewayFactory = gatewayFactory;
        _productRepository = productRepository;
        _tenantRepository = tenantRepository;
        _storeIntegrationRepository = storeIntegrationRepository;
        _robotActivityRepository = robotActivityRepository;
        _redisService = redisService;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<NuvemshopBulkSyncMessage> context)
    {
        var msg = context.Message;
        _logger.LogInformation("Processing Nuvemshop sync for Job {JobId} Sku {Sku} Tenant {TenantId}", msg.JobId, msg.Sku, msg.TenantId);

        // 1. Controle de Quotas Atômico: Verifica e deduz 1 crédito por SKU a sincronizar
        try
        {
            await _tenantRepository.DeductCreditsAsync(
                msg.TenantId,
                amount: 1,
                type: "PRODUCT_ENRICHMENT",
                description: $"Sincronização em lote Nuvemshop: SKU {msg.Sku}",
                referenceId: msg.JobId
            );
        }
        catch (InsufficientCreditsException ex)
        {
            _logger.LogWarning("Tenant {TenantId} com créditos insuficientes ({Current}) para sincronizar SKU '{Sku}' no Job {JobId}. Pausando sincronização.",
                msg.TenantId, ex.CurrentBalance, msg.Sku, msg.JobId);

            // Atualiza status da integração para 'paused_insufficient_credits'
            await _storeIntegrationRepository.UpdateStatusAsync(msg.TenantId, "Nuvemshop", "paused_insufficient_credits");

            // Emite evento SSE no Redis alertando sobre créditos esgotados
            var pauseSseEvent = new
            {
                type = "SYNC_PAUSED_INSUFFICIENT_CREDITS",
                platform = "Nuvemshop",
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
            _logger.LogWarning("Product {Sku} not found for Tenant {TenantId}", msg.Sku, msg.TenantId);
            // Estorna crédito deduzido pois produto não existe
            await _tenantRepository.AddCreditsAsync(
                msg.TenantId,
                amount: 1,
                type: "REFUND",
                description: $"Estorno por produto não encontrado para Nuvemshop (SKU: {msg.Sku})",
                referenceId: msg.JobId
            );
            return;
        }

        var nuvemshopGateway = _gatewayFactory.GetGateway("Nuvemshop");
        if (nuvemshopGateway == null)
        {
            _logger.LogError("NuvemshopGateway not found");
            await _tenantRepository.AddCreditsAsync(
                msg.TenantId,
                amount: 1,
                type: "REFUND",
                description: $"Estorno por gateway Nuvemshop não disponível (SKU: {msg.Sku})",
                referenceId: msg.JobId
            );
            return;
        }

        var success = await nuvemshopGateway.PushProductAsync(msg.TenantId, product);
        sw.Stop();

        // 2. Registra telemetria de atividade do robô
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

        // 3. Publica evento no Redis Pub/Sub para streaming SSE em tempo real no Frontend
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
            _logger.LogWarning("Failed to sync Sku {Sku} for Job {JobId}. Estornando 1 crédito.", msg.Sku, msg.JobId);
            await _tenantRepository.AddCreditsAsync(
                msg.TenantId,
                amount: 1,
                type: "REFUND",
                description: $"Estorno automático por falha no envio para Nuvemshop (SKU: {msg.Sku})",
                referenceId: msg.JobId
            );
            return;
        }

        _logger.LogInformation("Successfully synced Sku {Sku} for Job {JobId}", msg.Sku, msg.JobId);
    }
}
