using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Scraper;
using EcommerceBot.Application.Interfaces;
using MassTransit;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace EcommerceBot.Infrastructure.Services;

public class ScraperService : IScraperService
{
    private readonly ISendEndpointProvider _sendEndpointProvider;
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<ScraperService> _logger;

    public ScraperService(
        ISendEndpointProvider sendEndpointProvider, 
        IConnectionMultiplexer redis, 
        ILogger<ScraperService> logger)
    {
        _sendEndpointProvider = sendEndpointProvider;
        _redis = redis;
        _logger = logger;
    }

    private async Task CheckAndIncrementDailyQuotaAsync(Guid tenantId, string plan)
    {
        var planClean = plan?.ToLower() ?? "free";
        int quotaLimit = planClean switch
        {
            "free" => 10,
            "pro" => 500,
            "premium" => 500,
            "enterprise" => 5000,
            _ => 10
        };

        var today = DateTimeOffset.UtcNow.ToString("yyyy-MM-dd");
        var quotaKey = $"quota:tenant:{tenantId}:date:{today}";

        var db = _redis.GetDatabase();
        var currentUsage = await db.StringIncrementAsync(quotaKey);
        
        if (currentUsage == 1)
        {
            await db.KeyExpireAsync(quotaKey, TimeSpan.FromDays(2));
        }

        if (currentUsage > quotaLimit)
        {
            _logger.LogWarning("Daily extraction quota exceeded for Tenant {TenantId} (Plan: {Plan}). Current: {Current}, Limit: {Limit}", tenantId, planClean, currentUsage, quotaLimit);
            throw new InvalidOperationException("Daily extraction quota reached for your plan.");
        }
    }

    public async Task<string> EnqueueExtractionTaskAsync(Guid tenantId, string url, string plan)
    {
        // 1. Checar e incrementar cota diária no Redis (idêntico ao Python)
        await CheckAndIncrementDailyQuotaAsync(tenantId, plan);

        var productId = $"req_{Guid.NewGuid().ToString("N").Substring(0, 12)}";
        var planClean = plan?.ToLower() ?? "free";

        var routingKey = (planClean == "premium" || planClean == "pro" || planClean == "enterprise") 
            ? "ecommerce" 
            : "demo_ecommerce";

        var message = new ImportRequestMessage
        {
            ProductId = productId,
            TenantId = tenantId.ToString(),
            TargetUrl = url
        };

        // 2. Enviar mensagem diretamente para a fila
        var endpoint = await _sendEndpointProvider.GetSendEndpoint(new Uri($"queue:{routingKey}"));
        await endpoint.Send(message, context => 
        {
            context.Headers.Set("x-tenant-id", tenantId.ToString());
            context.Headers.Set("x-user-plan", planClean);
            context.MessageId = Guid.NewGuid();
        });

        _logger.LogInformation("Enqueued scraping task {ProductId} to queue {Queue} for Tenant {TenantId}", productId, routingKey, tenantId);

        return productId;
    }
}
