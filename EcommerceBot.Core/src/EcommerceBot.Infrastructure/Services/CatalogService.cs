using System;
using System.Linq;
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

public class CatalogService : ICatalogService
{
    private readonly IProductRepository _productRepository;
    private readonly ITenantRepository _tenantRepository;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly ILogger<CatalogService> _logger;

    public CatalogService(
        IProductRepository productRepository,
        ITenantRepository tenantRepository,
        IPublishEndpoint publishEndpoint,
        ILogger<CatalogService> logger)
    {
        _productRepository = productRepository;
        _tenantRepository = tenantRepository;
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

    public async Task<PaginatedProductsResponse> GetProductsAsync(Guid tenantId, string? status, string? search, int page, int limit)
    {
        var result = await _productRepository.GetPaginatedAsync(tenantId, status, search, page, limit);

        return new PaginatedProductsResponse
        {
            Data = result.Products.Select(MapToResponse).ToList(),
            TotalCount = result.TotalCount,
            Page = page,
            Limit = limit
        };
    }

    public async Task<ProductResponseDto?> UpdateProductAsync(Guid tenantId, string sku, ProductUpdateDto dto)
    {
        var product = await _productRepository.GetBySkuAsync(tenantId, sku);
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

        await _productRepository.UpdateAsync(product);

        var updated = await _productRepository.GetBySkuAsync(tenantId, sku);
        return updated != null ? MapToResponse(updated) : null;
    }

    public async Task<bool> DeleteProductAsync(Guid tenantId, string sku)
    {
        var product = await _productRepository.GetBySkuAsync(tenantId, sku);
        if (product == null) return false;

        await _productRepository.DeleteAsync(tenantId, sku);
        return true;
    }

    public async Task<ScrapingResponseDto> RequestScrapingAsync(Guid tenantId, ScrapingRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Url) || !UrlSecurityValidator.IsSafePublicUrl(request.Url))
        {
            throw new ArgumentException("URL inválida ou bloqueada por política de segurança Anti-SSRF.");
        }

        if (!await _tenantRepository.HasCreditsAsync(tenantId, 1))
        {
            throw new InvalidOperationException("Créditos insuficientes para realizar o scraping com IA.");
        }

        await _tenantRepository.DeductCreditsAsync(tenantId, 1);

        var sku = Guid.NewGuid().ToString("N")[..10].ToUpper();

        var product = new Product
        {
            TenantId = tenantId,
            Sku = sku,
            Title = request.Title ?? "Produto a ser analisado",
            SourceUrl = request.Url,
            Status = "RAW"
        };

        await _productRepository.AddAsync(product);

        await _publishEndpoint.Publish(new ScrapingRequestMessage
        {
            TenantId = tenantId,
            Sku = sku,
            Url = request.Url,
            PromptContext = request.CustomPrompt ?? string.Empty
        });

        _logger.LogInformation("Scraping enqueued for SKU '{Sku}', Tenant '{TenantId}'", sku, tenantId);

        return new ScrapingResponseDto
        {
            Message = "Scraping solicitado com sucesso.",
            Sku = sku,
            Status = "PROCESSING"
        };
    }
}
