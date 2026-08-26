using System;
using System.Linq;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Products;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Services;

public class CatalogService : ICatalogService
{
    private readonly IProductRepository _productRepository;

    public CatalogService(IProductRepository productRepository)
    {
        _productRepository = productRepository;
    }

    private ProductResponseDto MapToResponse(Product product)
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
}
