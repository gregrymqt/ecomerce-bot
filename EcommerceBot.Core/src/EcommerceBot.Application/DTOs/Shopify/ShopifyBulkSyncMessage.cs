using System;

namespace EcommerceBot.Application.DTOs.Shopify;

public sealed record ShopifyBulkSyncMessage
{
    public string JobId { get; init; } = string.Empty;
    public Guid TenantId { get; init; }
    public string Sku { get; init; } = string.Empty;
    public bool ForceUpdate { get; init; } = false;
    public string? Status { get; init; }
}
