using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Shopify;

public class ShopifyOAuthRequest
{
    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("shop")]
    public string Shop { get; set; } = string.Empty;

    [JsonPropertyName("state")]
    public string? State { get; set; }

    [JsonPropertyName("hmac")]
    public string? Hmac { get; set; }
}

public class ShopifyTokenResponse
{
    [JsonPropertyName("access_token")]
    public string AccessToken { get; set; } = string.Empty;

    [JsonPropertyName("scope")]
    public string Scope { get; set; } = string.Empty;
}

public class ShopifyCredentialsPayloadDto
{
    [JsonPropertyName("store_domain")]
    public string StoreDomain { get; set; } = string.Empty;

    [JsonPropertyName("admin_access_token")]
    public string AdminAccessToken { get; set; } = string.Empty;
}

public class ShopifySyncRequestDto
{
    [JsonPropertyName("tenant_id")]
    public string? TenantId { get; set; }

    [JsonPropertyName("sku")]
    public string Sku { get; set; } = string.Empty;

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("vendor")]
    public string? Vendor { get; set; }

    [JsonPropertyName("price")]
    public decimal? Price { get; set; }

    [JsonPropertyName("images")]
    public List<string>? Images { get; set; }

    [JsonPropertyName("tags")]
    public string? Tags { get; set; }

    [JsonPropertyName("seo_title")]
    public string? SeoTitle { get; set; }

    [JsonPropertyName("seo_description")]
    public string? SeoDescription { get; set; }
}

public class ShopifyProductResponseDto
{
    [JsonPropertyName("shopify_id")]
    public string? ShopifyId { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = "success";

    [JsonPropertyName("message")]
    public string? Message { get; set; }

    [JsonPropertyName("errors")]
    public List<string>? Errors { get; set; }
}

public class ShopifyInventoryUpdateDto
{
    [JsonPropertyName("available_quantity")]
    public int AvailableQuantity { get; set; }

    [JsonPropertyName("inventory_item_id")]
    public string? InventoryItemId { get; set; }

    [JsonPropertyName("location_id")]
    public string? LocationId { get; set; }
}

public class ShopifyStatusUpdateDto
{
    [JsonPropertyName("status")]
    public string Status { get; set; } = "ACTIVE"; // 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
}

public class ShopifyBulkSyncRequestDto
{
    [JsonPropertyName("skus")]
    public List<string> Skus { get; set; } = new();
}

public class ShopifyBulkSyncResponseDto
{
    [JsonPropertyName("job_id")]
    public string JobId { get; set; } = string.Empty;

    [JsonPropertyName("total_enqueued")]
    public int TotalEnqueued { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = "queued";

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;
}
