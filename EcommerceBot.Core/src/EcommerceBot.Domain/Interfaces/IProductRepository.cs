using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface IProductRepository
{
    Task<Product?> GetBySkuAsync(Guid tenantId, string sku);
    Task<IEnumerable<Product>> GetProductsAsync(Guid tenantId, int page, int pageSize);
    
    Task<(IEnumerable<Product> Products, int TotalCount)> GetPaginatedAsync(
        Guid tenantId, string? statusFilter, string? search, int page, int limit);
        
    Task<Guid> AddAsync(Product product);
    Task UpdateStatusAsync(Guid tenantId, string sku, string status, string? metadata = null);
    Task UpdateAsync(Product product);
    Task DeleteAsync(Guid tenantId, string sku);
}
