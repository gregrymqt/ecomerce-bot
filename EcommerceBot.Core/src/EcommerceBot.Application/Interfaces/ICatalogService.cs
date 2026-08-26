using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Products;

namespace EcommerceBot.Application.Interfaces;

public interface ICatalogService
{
    Task<PaginatedProductsResponse> GetProductsAsync(Guid tenantId, string? status, string? search, int page, int limit);
    Task<ProductResponseDto?> UpdateProductAsync(Guid tenantId, string sku, ProductUpdateDto dto);
    Task<bool> DeleteProductAsync(Guid tenantId, string sku);
    Task<ScrapingResponseDto> RequestScrapingAsync(Guid tenantId, ScrapingRequestDto request);
}
