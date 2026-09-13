using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Application.DTOs.Products;
using EcommerceBot.Application.Interfaces;
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
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly ILogger<CatalogService> _logger;

    public CatalogService(
        IProductRepository productRepository,
        ITenantRepository tenantRepository,
        ITenantAiCredentialRepository tenantAiCredentialRepository,
        IPublishEndpoint publishEndpoint,
        ILogger<CatalogService> logger)
    {
        _productRepository = productRepository;
        _tenantRepository = tenantRepository;
        _tenantAiCredentialRepository = tenantAiCredentialRepository;
        _publishEndpoint = publishEndpoint;
        _logger = logger;
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
        if (string.IsNullOrWhiteSpace(request.Url) || !UrlSecurityValidator.IsSafePublicUrl(request.Url))
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
            await _publishEndpoint.Publish(new ScrapingRequestMessage
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
                        type: "REFUND_SCRAPE_FAIL",
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
}
