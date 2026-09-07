using System;
using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.Nuvemshop;

public sealed record NuvemshopBulkSyncMessage
{
    public string JobId { get; init; } = string.Empty;
    public Guid TenantId { get; init; }
    public string Sku { get; init; } = string.Empty;
    public bool ForceUpdate { get; init; }
    public string Visibility { get; init; } = "visible";
}

public sealed record NuvemshopBulkSyncRequest
{
    public List<string> Skus { get; init; } = new();
    public bool ForceUpdate { get; init; }
    public string Visibility { get; init; } = "visible";
}
