using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Application.Interfaces;

public interface IEcommerceGateway
{
    string PlatformName { get; }
    Task<bool> PushProductAsync(Guid tenantId, Product product, CancellationToken cancellationToken = default);
    Task<IEnumerable<Product>> FetchProductsAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<(bool Success, int LatencyMs, string Message)> HealthCheckAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<bool> UpdateInventoryAsync(Guid tenantId, string sku, int availableQuantity, string? inventoryItemId = null, CancellationToken cancellationToken = default);
    Task<bool> UpdateProductStatusAsync(Guid tenantId, string sku, string status, CancellationToken cancellationToken = default);
    Task<bool> DeleteProductAsync(Guid tenantId, string sku, CancellationToken cancellationToken = default);
}

public interface IEcommerceGatewayFactory
{
    IEcommerceGateway GetGateway(string platformName);
}
