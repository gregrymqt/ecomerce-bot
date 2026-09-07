using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Shopify;

public sealed record ShopifyOAuthRequest
{
    [JsonPropertyName("code")]
    public string Code { get; init; } = string.Empty;

    [JsonPropertyName("shop")]
    public string Shop { get; init; } = string.Empty;

    [JsonPropertyName("state")]
    public string? State { get; init; }

    [JsonPropertyName("hmac")]
    public string? Hmac { get; init; }
}

public sealed record ShopifyTokenResponse
{
    [JsonPropertyName("access_token")]
    public string AccessToken { get; init; } = string.Empty;

    [JsonPropertyName("scope")]
    public string Scope { get; init; } = string.Empty;
}

public sealed record ShopifyCredentialsPayloadDto
{
    [JsonPropertyName("store_domain")]
    public string StoreDomain { get; init; } = string.Empty;

    [JsonPropertyName("admin_access_token")]
    public string AdminAccessToken { get; init; } = string.Empty;
}

public sealed record ShopifySyncRequestDto
{
    [JsonPropertyName("tenant_id")]
    public string? TenantId { get; init; }

    [JsonPropertyName("sku")]
    public string Sku { get; init; } = string.Empty;

    [JsonPropertyName("title")]
    public string Title { get; init; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("vendor")]
    public string? Vendor { get; init; }

    [JsonPropertyName("price")]
    public decimal? Price { get; init; }

    [JsonPropertyName("images")]
    public List<string>? Images { get; init; }

    [JsonPropertyName("tags")]
    public string? Tags { get; init; }

    [JsonPropertyName("seo_title")]
    public string? SeoTitle { get; init; }

    [JsonPropertyName("seo_description")]
    public string? SeoDescription { get; init; }
}

public sealed record ShopifyProductResponseDto
{
    [JsonPropertyName("shopify_id")]
    public string? ShopifyId { get; init; }

    [JsonPropertyName("status")]
    public string Status { get; init; } = "success";

    [JsonPropertyName("message")]
    public string? Message { get; init; }

    [JsonPropertyName("errors")]
    public List<string>? Errors { get; init; }
}

public sealed record ShopifyInventoryUpdateDto
{
    [JsonPropertyName("available_quantity")]
    public int AvailableQuantity { get; init; }

    [JsonPropertyName("inventory_item_id")]
    public string? InventoryItemId { get; init; }

    [JsonPropertyName("location_id")]
    public string? LocationId { get; init; }
}

public sealed record ShopifyStatusUpdateDto
{
    [JsonPropertyName("status")]
    public string Status { get; init; } = "ACTIVE"; // 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
}

public sealed record ShopifyBulkSyncRequestDto
{
    [JsonPropertyName("skus")]
    public List<string> Skus { get; init; } = new();
}

public sealed record ShopifyBulkSyncResponseDto
{
    [JsonPropertyName("job_id")]
    public string JobId { get; init; } = string.Empty;

    [JsonPropertyName("total_enqueued")]
    public int TotalEnqueued { get; init; }

    [JsonPropertyName("status")]
    public string Status { get; init; } = "queued";

    [JsonPropertyName("message")]
    public string Message { get; init; } = string.Empty;
}
