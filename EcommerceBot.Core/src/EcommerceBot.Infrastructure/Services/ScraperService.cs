using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Scraper;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Application.Security;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public class ScraperService : IScraperService
{
    private readonly ISendEndpointProvider _sendEndpointProvider;
    private readonly IRedisService _redisService;
    private readonly ITenantRepository _tenantRepository;
    private readonly ILogger<ScraperService> _logger;

    public ScraperService(
        ISendEndpointProvider sendEndpointProvider,
        IRedisService redisService,
        ITenantRepository tenantRepository,
        ILogger<ScraperService> logger)
    {
        _sendEndpointProvider = sendEndpointProvider;
        _redisService = redisService;
        _tenantRepository = tenantRepository;
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

        var currentUsage = await _redisService.IncrementAsync(quotaKey, 1, TimeSpan.FromDays(2));

        if (currentUsage > quotaLimit)
        {
            _logger.LogWarning("Daily extraction quota exceeded for Tenant {TenantId} (Plan: {Plan}). Current: {Current}, Limit: {Limit}", tenantId, planClean, currentUsage, quotaLimit);
            throw new InvalidOperationException("Daily extraction quota reached for your plan.");
        }
    }

    public async Task<string> EnqueueExtractionTaskAsync(Guid tenantId, string url, string? plan = null)
    {
        if (string.IsNullOrWhiteSpace(url) || !UrlSecurityValidator.IsSafePublicUrl(url))
        {
            throw new ArgumentException("URL inválida ou bloqueada por política de segurança Anti-SSRF.");
        }

        if (string.IsNullOrEmpty(plan))
        {
            var tenant = await _tenantRepository.GetByIdAsync(tenantId);
            plan = tenant?.PlanTier ?? "free";
        }

        // 1. Checar e incrementar cota diária no Redis
        await CheckAndIncrementDailyQuotaAsync(tenantId, plan);

        var productId = $"req_{Guid.NewGuid().ToString("N")[..12]}";
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

        // 2. Enviar mensagem para a fila
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
