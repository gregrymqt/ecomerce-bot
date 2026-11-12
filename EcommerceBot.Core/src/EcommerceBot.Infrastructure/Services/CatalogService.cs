using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Ai;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Application.DTOs.Products;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Application.Interfaces.Gateways;
using EcommerceBot.Application.Security;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public sealed class CatalogService : ICatalogService
{
    private readonly IProductRepository _productRepository;
    private readonly ITenantRepository _tenantRepository;
    private readonly ITenantAiCredentialRepository _tenantAiCredentialRepository;
    private readonly ISendEndpointProvider _sendEndpointProvider;
    private readonly ILogger<CatalogService> _logger;
    private readonly IOpenRouterGateway? _openRouterGateway;
    private readonly ICategorySeoGuidelinesRepository? _categorySeoRepository;
    private readonly IMeteringRepository? _meteringRepository;

    public CatalogService(
        IProductRepository productRepository,
        ITenantRepository tenantRepository,
        ITenantAiCredentialRepository tenantAiCredentialRepository,
        ISendEndpointProvider sendEndpointProvider,
        ILogger<CatalogService> logger,
        IOpenRouterGateway? openRouterGateway = null,
        ICategorySeoGuidelinesRepository? categorySeoRepository = null,
        IMeteringRepository? meteringRepository = null)
    {
        _productRepository = productRepository;
        _tenantRepository = tenantRepository;
        _tenantAiCredentialRepository = tenantAiCredentialRepository;
        _sendEndpointProvider = sendEndpointProvider;
        _logger = logger;
        _openRouterGateway = openRouterGateway;
        _categorySeoRepository = categorySeoRepository;
        _meteringRepository = meteringRepository;
    }

    private static ProductResponseDto MapToResponse(Product product)
    {
        return new ProductResponseDto
        {
            Id = product.Id,
            Sku = product.Sku,
            Title = product.Title,
            Description = product.Description,
            Price = product.Price,
            OriginalPrice = product.OriginalPrice,
            StockQuantity = product.StockQuantity,
            Category = product.Category,
            Brand = product.Brand,
            Status = product.Status,
            ImagesJson = product.ImagesJson,
            CreatedAt = product.CreatedAt,
            UpdatedAt = product.UpdatedAt
        };
    }

    public async Task<PaginatedProductsResponse> GetProductsAsync(
        Guid tenantId, 
        string? status, 
        string? search, 
        int page, 
        int limit, 
        CancellationToken cancellationToken = default)
    {
        var result = await _productRepository.GetPaginatedAsync(tenantId, status, search, page, limit, cancellationToken);

        return new PaginatedProductsResponse
        {
            Data = result.Products.Select(MapToResponse).ToList(),
            TotalCount = result.TotalCount,
            Page = page,
            Limit = limit
        };
    }

    public async Task<ProductResponseDto?> UpdateProductAsync(
        Guid tenantId, 
        string sku, 
        ProductUpdateDto dto, 
        CancellationToken cancellationToken = default)
    {
        try
        {
            var product = await _productRepository.GetBySkuAsync(tenantId, sku, cancellationToken);
            if (product == null) return null;

            if (dto.Title != null) product.Title = dto.Title;
            if (dto.Description != null) product.Description = dto.Description;
            if (dto.Price.HasValue) product.Price = dto.Price.Value;
            if (dto.OriginalPrice.HasValue) product.OriginalPrice = dto.OriginalPrice.Value;
            if (dto.StockQuantity.HasValue) product.StockQuantity = dto.StockQuantity.Value;
            if (dto.Category != null) product.Category = dto.Category;
            if (dto.Brand != null) product.Brand = dto.Brand;
            if (dto.Status != null) product.Status = dto.Status;
            if (dto.ImagesJson != null) product.ImagesJson = dto.ImagesJson;

            await _productRepository.UpdateAsync(product, cancellationToken);

            var updated = await _productRepository.GetBySkuAsync(tenantId, sku, cancellationToken);
            return updated != null ? MapToResponse(updated) : null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao atualizar produto SKU {Sku} para o Tenant {TenantId}", sku, tenantId);
            throw;
        }
    }

    public async Task<bool> DeleteProductAsync(Guid tenantId, string sku, CancellationToken cancellationToken = default)
    {
        try
        {
            var product = await _productRepository.GetBySkuAsync(tenantId, sku, cancellationToken);
            if (product == null) return false;

            await _productRepository.DeleteAsync(tenantId, sku, cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao excluir produto SKU {Sku} para o Tenant {TenantId}", sku, tenantId);
            throw;
        }
    }

    public async Task<ScrapingResponseDto> RequestScrapingAsync(
        Guid tenantId, 
        ScrapingRequestDto request, 
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Url) ||
            !await UrlSecurityValidator.IsSafePublicUrlAsync(request.Url, cancellationToken: cancellationToken))
        {
            throw new ArgumentException("URL inválida ou bloqueada por política de segurança Anti-SSRF.");
        }

        var sku = Guid.NewGuid().ToString("N")[..10].ToUpper();

        // 1. Verificação de credencial BYOK ativa para o Tenant
        var hasByok = await _tenantAiCredentialRepository.HasActiveByokAsync(tenantId, cancellationToken);
        if (!hasByok)
        {
            // Dedução atômica de 1 crédito anti-double-spending (lança InsufficientCreditsException se insuficiente)
            await _tenantRepository.DeductCreditsAsync(
                tenantId,
                1,
                type: "PRODUCT_ENRICHMENT",
                description: "Extração e enriquecimento de catálogo com IA",
                referenceId: sku,
                cancellationToken: cancellationToken);
        }
        else
        {
            _logger.LogInformation("Tenant '{TenantId}' possui BYOK ativo. Isenção de dedução de créditos da plataforma para SKU '{Sku}'.", tenantId, sku);
        }

        var product = new Product
        {
            TenantId = tenantId,
            Sku = sku,
            Title = request.Title ?? "Produto a ser analisado",
            SourceUrl = request.Url,
            Status = "RAW"
        };

        await _productRepository.AddAsync(product, cancellationToken);

        try
        {
            var endpoint = await _sendEndpointProvider.GetSendEndpoint(new Uri("exchange:ecommerce"));
            await endpoint.Send(new ScrapingRequestMessage
            {
                TenantId = tenantId,
                Sku = sku,
                Url = request.Url,
                PromptContext = request.CustomPrompt ?? string.Empty,
                IsByok = hasByok
            }, cancellationToken);

            _logger.LogInformation("Scraping enqueued for SKU '{Sku}', Tenant '{TenantId}'", sku, tenantId);

            return new ScrapingResponseDto
            {
                Message = "Scraping solicitado com sucesso.",
                Sku = sku,
                Status = "PROCESSING"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha ao publicar mensagem de scraping para o SKU '{Sku}', Tenant '{TenantId}'. Realizando compensação...", sku, tenantId);

            if (!hasByok)
            {
                try
                {
                    await _tenantRepository.AddCreditsAsync(
                        tenantId,
                        1,
                        type: "REFUND",
                        description: $"Reembolso automático: Falha no enfileiramento do SKU {sku}",
                        referenceId: sku,
                        cancellationToken: cancellationToken);

                    _logger.LogInformation("Crédito estornado com sucesso para SKU '{Sku}', Tenant '{TenantId}'.", sku, tenantId);
                }
                catch (Exception refundEx)
                {
                    _logger.LogCritical(refundEx, "ERRO CRÍTICO: Falha ao estornar crédito para SKU '{Sku}', Tenant '{TenantId}'.", sku, tenantId);
                }
            }

            try
            {
                product.Status = "FAILED";
                await _productRepository.UpdateAsync(product, cancellationToken);
            }
            catch (Exception updateEx)
            {
                _logger.LogWarning(updateEx, "Aviso: Falha ao atualizar status do produto {Sku} para FAILED.", sku);
            }

            throw;
        }
    }

    public async Task<ProductResponseDto?> RegenerateProductCopyAsync(
        Guid tenantId,
        string sku,
        CancellationToken cancellationToken = default)
    {
        if (_openRouterGateway == null)
        {
            throw new InvalidOperationException("Gateway de IA não configurado no container da API.");
        }

        var product = await _productRepository.GetBySkuAsync(tenantId, sku, cancellationToken);
        if (product == null)
        {
            return null;
        }

        var hasByok = await _tenantAiCredentialRepository.HasActiveByokAsync(tenantId, cancellationToken);
        if (!hasByok)
        {
            await _tenantRepository.DeductCreditsAsync(
                tenantId,
                1,
                type: "PRODUCT_ENRICHMENT",
                description: $"Regeneração de copywriting IA (SKU: {sku})",
                referenceId: sku,
                cancellationToken: cancellationToken);
        }

        try
        {
            var category = string.IsNullOrWhiteSpace(product.Category) ? "Geral" : product.Category;
            CategorySeoGuidelineDto? seoGuideline = null;

            if (_categorySeoRepository != null)
            {
                try
                {
                    var guideline = await _categorySeoRepository.GetGuidelineByCategoryAsync(
                        tenantId,
                        category,
                        cancellationToken);

                    if (guideline != null)
                    {
                        seoGuideline = new CategorySeoGuidelineDto
                        {
                            Id = guideline.Id,
                            TenantId = guideline.TenantId,
                            CategoryPattern = guideline.CategoryPattern,
                            MandatoryKeywords = guideline.MandatoryKeywords,
                            RecommendedTone = guideline.RecommendedTone,
                            FewShotExampleTitle = guideline.FewShotExampleTitle,
                            FewShotExampleDescription = guideline.FewShotExampleDescription
                        };
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Falha ao buscar diretriz de SEO na regeneração do SKU {Sku}. Prosseguindo sem diretriz customizada.", sku);
                }
            }

            var images = new List<string>();
            if (!string.IsNullOrWhiteSpace(product.ImagesJson))
            {
                try
                {
                    var parsedImages = JsonSerializer.Deserialize<List<string>>(product.ImagesJson);
                    if (parsedImages != null)
                    {
                        images = parsedImages;
                    }
                }
                catch
                {
                    // Ignora JSON legado malformado de imagens ao montar contexto da LLM
                }
            }

            var metaAttributes = new Dictionary<string, string>();
            if (!string.IsNullOrWhiteSpace(product.Category))
            {
                metaAttributes["category"] = product.Category;
            }
            if (!string.IsNullOrWhiteSpace(product.Brand))
            {
                metaAttributes["brand"] = product.Brand;
            }

            var llmRequest = new ProductEnrichmentLlmRequest
            {
                TenantId = tenantId,
                Sku = product.Sku,
                Url = product.SourceUrl ?? string.Empty,
                RawTitle = product.Title,
                RawDescriptionHtml = product.Description ?? string.Empty,
                RawMarkdown = !string.IsNullOrWhiteSpace(product.Description) ? product.Description : product.Title,
                Price = product.Price,
                Currency = "BRL",
                Images = images,
                MetaAttributes = metaAttributes,
                PromptContext = "Regenerar copywriting de produto com foco em SEO e conversão mantendo veracidade técnica.",
                UseTenantByok = hasByok,
                SeoGuideline = seoGuideline
            };

            var enrichmentResult = await _openRouterGateway.EnrichProductAsync(llmRequest, cancellationToken);
            if (enrichmentResult.IsFallback && !string.IsNullOrWhiteSpace(enrichmentResult.ErrorMessage))
            {
                throw new InvalidOperationException(enrichmentResult.ErrorMessage);
            }

            product.Title = !string.IsNullOrWhiteSpace(enrichmentResult.Title) ? enrichmentResult.Title : product.Title;
            product.Description = !string.IsNullOrWhiteSpace(enrichmentResult.Description) ? enrichmentResult.Description : product.Description;
            product.Status = "PROCESSED";
            product.ErrorMessage = null;
            product.EnrichmentMetadata = JsonSerializer.Serialize(new
            {
                bulletPoints = enrichmentResult.BulletPoints,
                seoKeywords = enrichmentResult.SeoKeywords,
                faqs = enrichmentResult.Faqs,
                modelUsed = enrichmentResult.ModelUsed,
                promptTokens = enrichmentResult.PromptTokens,
                completionTokens = enrichmentResult.CompletionTokens,
                totalTokens = enrichmentResult.TotalTokens,
                executionTimeMs = enrichmentResult.ExecutionTimeMs,
                costUsd = enrichmentResult.TotalCostEstimated,
                regeneratedAt = DateTimeOffset.UtcNow
            });

            await _productRepository.UpdateAsync(product, cancellationToken);

            if (_meteringRepository != null)
            {
                try
                {
                    var usageLog = new LlmUsageLog
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        ProductId = product.Sku,
                        Provider = "OPENROUTER",
                        ModelUsed = !string.IsNullOrWhiteSpace(enrichmentResult.ModelUsed) ? enrichmentResult.ModelUsed : "openrouter/auto",
                        PromptTokens = enrichmentResult.PromptTokens,
                        CompletionTokens = enrichmentResult.CompletionTokens,
                        TotalTokens = enrichmentResult.TotalTokens,
                        EstimatedCostUsd = enrichmentResult.TotalCostEstimated,
                        IsByok = hasByok,
                        ExecutionTimeMs = enrichmentResult.ExecutionTimeMs.HasValue
                            ? (int)Math.Min(enrichmentResult.ExecutionTimeMs.Value, int.MaxValue)
                            : null,
                        CreatedAt = DateTimeOffset.UtcNow
                    };

                    await _meteringRepository.CreateUsageLogAsync(usageLog, cancellationToken);
                }
                catch (Exception logEx)
                {
                    _logger.LogError(logEx, "Falha ao persistir telemetria em LlmUsageLogs na regeneração do SKU {Sku}", sku);
                }
            }

            var updated = await _productRepository.GetBySkuAsync(tenantId, sku, cancellationToken);
            return MapToResponse(updated ?? product);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha na regeneração com IA para o SKU '{Sku}', Tenant '{TenantId}'.", sku, tenantId);

            if (!hasByok)
            {
                try
                {
                    await _tenantRepository.AddCreditsAsync(
                        tenantId,
                        1,
                        type: "REFUND",
                        description: $"Reembolso automático: Falha na regeneração de copywriting do SKU {sku}",
                        referenceId: sku,
                        cancellationToken: cancellationToken);
                }
                catch (Exception refundEx)
                {
                    _logger.LogCritical(refundEx, "ERRO CRÍTICO: Falha ao estornar crédito na regeneração do SKU '{Sku}', Tenant '{TenantId}'.", sku, tenantId);
                }
            }

            throw;
        }
    }
}
