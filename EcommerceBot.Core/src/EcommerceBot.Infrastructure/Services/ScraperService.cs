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
    private readonly ITenantRepository _tenantRepository;
    private readonly ILogger<ScraperService> _logger;

    public ScraperService(
        ISendEndpointProvider sendEndpointProvider,
        ITenantRepository tenantRepository,
        ILogger<ScraperService> logger)
    {
        _sendEndpointProvider = sendEndpointProvider;
        _tenantRepository = tenantRepository;
        _logger = logger;
    }

    public async Task<string> EnqueueExtractionTaskAsync(Guid tenantId, string url, string? plan = null)
    {
        if (string.IsNullOrWhiteSpace(url) || !UrlSecurityValidator.IsSafePublicUrl(url))
        {
            throw new ArgumentException("URL inválida ou bloqueada por política de segurança Anti-SSRF.");
        }

        var productId = $"req_{Guid.NewGuid().ToString("N")[..12]}";

        // Dedução atômica de 1 crédito anti-double-spending (lança InsufficientCreditsException se saldo insuficiente)
        await _tenantRepository.DeductCreditsAsync(
            tenantId,
            1,
            type: "PRODUCT_ENRICHMENT",
            description: "Extração e enriquecimento de produto com IA",
            referenceId: productId);

        if (string.IsNullOrEmpty(plan))
        {
            var tenant = await _tenantRepository.GetByIdAsync(tenantId);
            plan = tenant?.PlanTier ?? "free";
        }

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

        // Enviar mensagem para a fila
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
