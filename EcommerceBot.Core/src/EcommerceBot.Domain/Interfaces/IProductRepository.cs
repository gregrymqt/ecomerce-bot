using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface IProductRepository
{
    Task<Product?> GetBySkuAsync(Guid tenantId, string sku, CancellationToken cancellationToken = default);
    Task<IEnumerable<Product>> GetProductsAsync(Guid tenantId, int page, int pageSize, CancellationToken cancellationToken = default);
    
    Task<(IEnumerable<Product> Products, int TotalCount)> GetPaginatedAsync(
        Guid tenantId, string? statusFilter, string? search, int page, int limit, CancellationToken cancellationToken = default);
        
    Task<Guid> AddAsync(Product product, CancellationToken cancellationToken = default);
    Task UpdateStatusAsync(Guid tenantId, string sku, string status, string? metadata = null, CancellationToken cancellationToken = default);
    Task UpdateAsync(Product product, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid tenantId, string sku, CancellationToken cancellationToken = default);
}
