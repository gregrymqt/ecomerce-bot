using System;

namespace EcommerceBot.Application.DTOs.Shopify;

public class ShopifyBulkSyncMessage
{
    public string JobId { get; set; } = string.Empty;
    public Guid TenantId { get; set; }
    public string Sku { get; set; } = string.Empty;
    public bool ForceUpdate { get; set; } = false;
    public string? Status { get; set; }
}
