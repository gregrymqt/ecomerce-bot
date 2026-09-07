using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Products;

namespace EcommerceBot.Application.Interfaces;

public interface ICatalogService
{
    Task<PaginatedProductsResponse> GetProductsAsync(Guid tenantId, string? status, string? search, int page, int limit, CancellationToken cancellationToken = default);
    Task<ProductResponseDto?> UpdateProductAsync(Guid tenantId, string sku, ProductUpdateDto dto, CancellationToken cancellationToken = default);
    Task<bool> DeleteProductAsync(Guid tenantId, string sku, CancellationToken cancellationToken = default);
    Task<ScrapingResponseDto> RequestScrapingAsync(Guid tenantId, ScrapingRequestDto request, CancellationToken cancellationToken = default);
}
