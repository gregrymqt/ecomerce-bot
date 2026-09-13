using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Application.DTOs.Scraper;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Application.Security;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public sealed class ScraperService : IScraperService
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

        var message = new ScrapingRequestMessage
        {
            TenantId = tenantId,
            Sku = productId,
            Url = url,
            PromptContext = string.Empty,
            IsByok = false
        };

        // Enviar mensagem para a exchange correspondente com proteção contra falha de mensageria
        try
        {
            var endpoint = await _sendEndpointProvider.GetSendEndpoint(new Uri($"exchange:{routingKey}"));
            await endpoint.Send(message, context =>
            {
                context.Headers.Set("x-tenant-id", tenantId.ToString());
                context.Headers.Set("x-user-plan", planClean);
                context.MessageId = Guid.NewGuid();
            });

            _logger.LogInformation("Enqueued scraping task {ProductId} to queue {Queue} for Tenant {TenantId}", productId, routingKey, tenantId);
            return productId;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha ao despachar tarefa de extração {ProductId} para o RabbitMQ (Exchange: {Exchange}) do Tenant {TenantId}. Estornando crédito...", productId, routingKey, tenantId);

            try
            {
                await _tenantRepository.AddCreditsAsync(
                    tenantId,
                    1,
                    type: "REFUND_SCRAPE_FAIL",
                    description: $"Reembolso automático: Falha no enfileiramento da tarefa {productId}",
                    referenceId: productId);

                _logger.LogInformation("Crédito estornado com sucesso para o Tenant {TenantId}. Tarefa: {ProductId}", tenantId, productId);
            }
            catch (Exception refundEx)
            {
                _logger.LogCritical(refundEx, "ERRO CRÍTICO: Falha ao estornar crédito do Tenant {TenantId} após erro no RabbitMQ. Tarefa: {ProductId}", tenantId, productId);
            }

            throw;
        }
    }
}
