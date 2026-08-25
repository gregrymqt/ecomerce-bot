using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface IProductRepository
{
    Task<Product?> GetBySkuAsync(Guid tenantId, string sku);
    Task<IEnumerable<Product>> GetProductsAsync(Guid tenantId, int page, int pageSize);
    Task<Guid> AddAsync(Product product);
    Task UpdateStatusAsync(Guid tenantId, string sku, string status, string? metadata = null);
}
