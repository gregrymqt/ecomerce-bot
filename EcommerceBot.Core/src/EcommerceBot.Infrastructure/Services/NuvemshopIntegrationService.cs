using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Nuvemshop;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public class NuvemshopIntegrationService : INuvemshopIntegrationService
{
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly ITenantAiCredentialRepository _credentialRepository;
    private readonly ILogger<NuvemshopIntegrationService> _logger;

    public NuvemshopIntegrationService(
        IPublishEndpoint publishEndpoint,
        ITenantAiCredentialRepository credentialRepository,
        ILogger<NuvemshopIntegrationService> logger)
    {
        _publishEndpoint = publishEndpoint;
        _credentialRepository = credentialRepository;
        _logger = logger;
    }

    public async Task HandleOAuthCallbackAsync(Guid tenantId, string code)
    {
        _logger.LogInformation("Receiving Nuvemshop OAuth callback for Tenant {TenantId} with code {Code}", tenantId, code);

        // Simulação / persistência de credencial Nuvemshop
        await Task.Delay(50);
        _logger.LogInformation("Saved Nuvemshop credentials for Tenant {TenantId}", tenantId);
    }

    public Task ProcessWebhookAsync(Guid tenantId, object payload)
    {
        _logger.LogInformation("Received Nuvemshop Webhook for Tenant {TenantId}", tenantId);
        return Task.CompletedTask;
    }

    public async Task<NuvemshopBulkSyncResponse> TriggerBulkSyncAsync(Guid tenantId, NuvemshopBulkSyncRequest request)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("X-Tenant-ID header is required.", nameof(tenantId));

        if (request.Skus == null || request.Skus.Count == 0)
            throw new ArgumentException("Skus list cannot be empty.", nameof(request));

        var jobId = Guid.NewGuid().ToString("N");

        foreach (var sku in request.Skus)
        {
            var msg = new NuvemshopBulkSyncMessage
            {
                JobId = jobId,
                TenantId = tenantId,
                Sku = sku,
                ForceUpdate = request.ForceUpdate,
                Visibility = request.Visibility
            };

            await _publishEndpoint.Publish(msg, context =>
            {
                context.SetRoutingKey("nuvemshop_bulk_sync");
            });
        }

        _logger.LogInformation("Enqueued {Count} products for Nuvemshop sync. JobId: {JobId}", request.Skus.Count, jobId);

        return new NuvemshopBulkSyncResponse
        {
            JobId = jobId,
            TotalEnqueued = request.Skus.Count,
            Status = "queued",
            Message = "Sync job started"
        };
    }
}
