using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Application.Interfaces;

public interface IEcommerceGateway
{
    string PlatformName { get; }
    Task<bool> PushProductAsync(Guid tenantId, Product product);
    Task<IEnumerable<Product>> FetchProductsAsync(Guid tenantId);
    Task<(bool Success, int LatencyMs, string Message)> HealthCheckAsync(Guid tenantId);
    Task<bool> UpdateInventoryAsync(Guid tenantId, string sku, int availableQuantity, string? inventoryItemId = null);
    Task<bool> UpdateProductStatusAsync(Guid tenantId, string sku, string status);
    Task<bool> DeleteProductAsync(Guid tenantId, string sku);
}

public interface IEcommerceGatewayFactory
{
    IEcommerceGateway GetGateway(string platformName);
}
