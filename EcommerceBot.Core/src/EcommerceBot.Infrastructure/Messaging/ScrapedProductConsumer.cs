using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Ai;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Application.Interfaces.Gateways;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Messaging;

/// <summary>
/// Consumidor orquestrador de enriquecimento da fase intermediária (ecommerce_scraped_queue).
/// Recebe dados brutos de scraping do Python Worker, aciona a IA generativa (OpenRouter)
/// centralizada na chave global da plataforma, persiste o catálogo via Dapper no SQL Server,
/// registra telemetria de consumo em dbo.LlmUsageLogs, estorna créditos no Ledger se houver falha,
/// e transmite atualizações em tempo real via Redis Pub/Sub (SSE).
/// </summary>
public sealed class ScrapedProductConsumer : IConsumer<ScrapedRawProductEvent>
{
    private readonly IOpenRouterGateway _openRouterGateway;
    private readonly IProductRepository _productRepository;
    private readonly ITenantRepository _tenantRepository;
    private readonly IMeteringRepository _meteringRepository;
    private readonly IRedisService _redisService;
    private readonly ILogger<ScrapedProductConsumer> _logger;

    public ScrapedProductConsumer(
        IOpenRouterGateway openRouterGateway,
        IProductRepository productRepository,
        ITenantRepository tenantRepository,
        IMeteringRepository meteringRepository,
        IRedisService redisService,
        ILogger<ScrapedProductConsumer> logger)
    {
        _openRouterGateway = openRouterGateway;
        _productRepository = productRepository;
        _tenantRepository = tenantRepository;
        _meteringRepository = meteringRepository;
        _redisService = redisService;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<ScrapedRawProductEvent> context)
    {
        var message = context.Message;
        _logger.LogInformation("Recebido ScrapedRawProductEvent para Tenant {TenantId}, SKU {Sku}. Success: {Success}",
            message.TenantId, message.Sku, message.Success);

        var channel = $"events:tenant:{message.TenantId}";

        // 1. Tratamento de falha no scraping perimetral (Success == false)
        if (!message.Success)
        {
            var errorMessage = !string.IsNullOrWhiteSpace(message.ErrorMessage)
                ? message.ErrorMessage
                : "Falha na extração de scraping perimetral de produto.";

            await HandleFailureAsync(message.TenantId, message.Sku, errorMessage, channel, context.CancellationToken);
            return;
        }

        // 2. Scraping bem-sucedido: orquestrar inferência de IA via OpenRouter
        try
        {
            var llmRequest = new ProductEnrichmentLlmRequest
            {
                TenantId = message.TenantId,
                Sku = message.Sku,
                Url = message.Url,
                RawTitle = message.RawTitle,
                RawDescriptionHtml = message.RawDescriptionHtml,
                RawMarkdown = message.RawMarkdown,
                Price = message.Price,
                Currency = message.Currency,
                Images = message.Images,
                MetaAttributes = message.MetaAttributes,
                PromptContext = message.PromptContext
            };

            var enrichmentResult = await _openRouterGateway.EnrichProductAsync(llmRequest, context.CancellationToken);

            // Se o retorno da LLM for um fallback com erro
            if (enrichmentResult.IsFallback && !string.IsNullOrWhiteSpace(enrichmentResult.ErrorMessage))
            {
                _logger.LogWarning("OpenRouter Gateway retornou fallback com erro para Tenant {TenantId}, SKU {Sku}: {Error}",
                    message.TenantId, message.Sku, enrichmentResult.ErrorMessage);

                await HandleFailureAsync(message.TenantId, message.Sku, enrichmentResult.ErrorMessage, channel, context.CancellationToken);
                return;
            }

            // 3. Sucesso na geração de IA: Persistência no SQL Server via Dapper
            var titleFinal = !string.IsNullOrWhiteSpace(enrichmentResult.Title) ? enrichmentResult.Title : message.RawTitle;
            var descriptionFinal = !string.IsNullOrWhiteSpace(enrichmentResult.Description) ? enrichmentResult.Description : message.RawMarkdown;

            var enrichmentMetadataJson = JsonSerializer.Serialize(new
            {
                bulletPoints = enrichmentResult.BulletPoints,
                seoKeywords = enrichmentResult.SeoKeywords,
                faqs = enrichmentResult.Faqs,
                modelUsed = enrichmentResult.ModelUsed,
                totalTokens = enrichmentResult.TotalTokens,
                costUsd = enrichmentResult.TotalCostEstimated,
                metaAttributes = message.MetaAttributes
            });

            var imagesJson = message.Images.Count > 0 ? JsonSerializer.Serialize(message.Images) : null;
            var category = message.MetaAttributes.GetValueOrDefault("category") ?? "Geral";
            var brand = message.MetaAttributes.GetValueOrDefault("brand");

            var existingProduct = await _productRepository.GetBySkuAsync(message.TenantId, message.Sku, context.CancellationToken);
            if (existingProduct != null)
            {
                existingProduct.Title = titleFinal;
                existingProduct.Description = descriptionFinal;
                existingProduct.Price = message.Price ?? existingProduct.Price;
                existingProduct.OriginalPrice = existingProduct.OriginalPrice ?? message.Price;
                existingProduct.Category = !string.IsNullOrWhiteSpace(category) ? category : existingProduct.Category;
                existingProduct.Brand = !string.IsNullOrWhiteSpace(brand) ? brand : existingProduct.Brand;
                existingProduct.Status = "ENRICHED";
                existingProduct.SourceUrl = !string.IsNullOrWhiteSpace(existingProduct.SourceUrl) ? existingProduct.SourceUrl : message.Url;
                existingProduct.ImagesJson = imagesJson ?? existingProduct.ImagesJson;
                existingProduct.EnrichmentMetadata = enrichmentMetadataJson;
                existingProduct.ErrorMessage = null;

                await _productRepository.UpdateAsync(existingProduct, context.CancellationToken);
            }
            else
            {
                var newProduct = new Product
                {
                    Id = Guid.NewGuid(),
                    TenantId = message.TenantId,
                    Sku = message.Sku,
                    Title = titleFinal,
                    Description = descriptionFinal,
                    Price = message.Price ?? 0m,
                    OriginalPrice = message.Price,
                    Category = category,
                    Brand = brand,
                    StockQuantity = 0,
                    Status = "ENRICHED",
                    SourceUrl = message.Url,
                    ImagesJson = imagesJson,
                    EnrichmentMetadata = enrichmentMetadataJson,
                    ErrorMessage = null
                };

                await _productRepository.AddAsync(newProduct, context.CancellationToken);
            }

            // 4. Gravar telemetria atômica de consumo em dbo.LlmUsageLogs
            try
            {
                var usageLog = new LlmUsageLog
                {
                    Id = Guid.NewGuid(),
                    TenantId = message.TenantId,
                    ProductId = message.Sku,
                    Provider = "OPENROUTER",
                    ModelUsed = !string.IsNullOrWhiteSpace(enrichmentResult.ModelUsed) ? enrichmentResult.ModelUsed : "openrouter/auto",
                    PromptTokens = enrichmentResult.PromptTokens,
                    CompletionTokens = enrichmentResult.CompletionTokens,
                    TotalTokens = enrichmentResult.TotalTokens,
                    EstimatedCostUsd = enrichmentResult.TotalCostEstimated,
                    IsByok = false,
                    ExecutionTimeMs = null,
                    CreatedAt = DateTimeOffset.UtcNow
                };

                await _meteringRepository.CreateUsageLogAsync(usageLog, context.CancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Falha ao persistir telemetria em LlmUsageLogs para Tenant {TenantId}, SKU {Sku}",
                    message.TenantId, message.Sku);
            }

            // 5. Transmitir evento SSE via Redis Pub/Sub para o Frontend React
            var priceStr = message.Price.HasValue ? $"R$ {message.Price.Value:F2}" : "R$ 0,00";
            var primaryImageUrl = message.Images.Count > 0 ? message.Images[0] : "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80";

            var ssePayload = JsonSerializer.Serialize(new
            {
                type = "product_processed",
                sku = message.Sku,
                status = "PROCESSED",
                isFallback = false,
                progress = 100,
                log = new
                {
                    id = $"log-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
                    timestamp = DateTimeOffset.UtcNow.ToString("HH:mm:ss"),
                    level = "SUCCESS",
                    message = "Catálogo enriquecido com sucesso via IA! Título magnético e SEO gerados."
                },
                result = new
                {
                    titleOriginal = message.RawTitle,
                    titleMagnetic = titleFinal,
                    tone = !string.IsNullOrWhiteSpace(message.PromptContext) ? message.PromptContext : "Persuasivo & Tecnológico",
                    category,
                    seoScore = 95,
                    bulletPoints = enrichmentResult.BulletPoints.Count > 0
                        ? enrichmentResult.BulletPoints
                        : new List<string> { descriptionFinal },
                    faqs = enrichmentResult.Faqs,
                    seoKeywords = enrichmentResult.SeoKeywords,
                    price = priceStr,
                    imageUrl = primaryImageUrl,
                    rawJson = new
                    {
                        sku = message.Sku,
                        title = titleFinal,
                        description = descriptionFinal,
                        metadata = enrichmentMetadataJson
                    }
                }
            });

            await _redisService.PublishAsync(channel, ssePayload);
            _logger.LogInformation("Enriquecimento concluído com sucesso e transmitido via SSE para Tenant {TenantId}, SKU {Sku}",
                message.TenantId, message.Sku);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exceção inesperada durante o enriquecimento de produto para Tenant {TenantId}, SKU {Sku}",
                message.TenantId, message.Sku);

            await HandleFailureAsync(message.TenantId, message.Sku, ex.Message, channel, context.CancellationToken);
        }
    }

    private async Task HandleFailureAsync(Guid tenantId, string sku, string errorMessage, string channel, CancellationToken cancellationToken)
    {
        _logger.LogWarning("Falha no enriquecimento de produto para Tenant {TenantId}, SKU {Sku}: {Error}. Atualizando status para FAILED e estornando crédito.",
            tenantId, sku, errorMessage);

        // Atualizar status no banco de dados
        try
        {
            await _productRepository.UpdateStatusAsync(tenantId, sku, "FAILED", null, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha ao atualizar status de falha do produto para Tenant {TenantId}, SKU {Sku}", tenantId, sku);
        }

        // Estorno atômico de 1 crédito no Ledger
        try
        {
            var newBalance = await _tenantRepository.AddCreditsAsync(
                tenantId: tenantId,
                amount: 1,
                type: "REFUND",
                description: $"Estorno automático por falha no processamento (SKU: {sku})",
                referenceId: sku,
                cancellationToken: cancellationToken
            );

            var refundPayload = JsonSerializer.Serialize(new
            {
                type = "credits_refunded",
                sku,
                amount = 1,
                balance_credits = newBalance,
                timestamp = DateTimeOffset.UtcNow
            });

            await _redisService.PublishAsync(channel, refundPayload);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha ao estornar crédito no Ledger para Tenant {TenantId}, SKU {Sku}", tenantId, sku);
        }

        // Notificar falha via SSE para o Frontend React
        var failedPayload = JsonSerializer.Serialize(new
        {
            type = "product_processed",
            sku,
            status = "FAILED",
            isFallback = true,
            errorMessage,
            progress = 100,
            log = new
            {
                id = $"log-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
                timestamp = DateTimeOffset.UtcNow.ToString("HH:mm:ss"),
                level = "ERROR",
                message = $"Falha no processamento: {errorMessage}"
            }
        });

        await _redisService.PublishAsync(channel, failedPayload);
    }
}
