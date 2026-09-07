using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Nuvemshop;

public sealed record NuvemshopCredentialsPayloadDto
{
    [JsonPropertyName("store_id")]
    public string StoreId { get; init; } = string.Empty;

    [JsonPropertyName("access_token")]
    public string AccessToken { get; init; } = string.Empty;
}

public sealed record NuvemshopOAuthTokenResponse
{
    [JsonPropertyName("access_token")]
    public string? AccessToken { get; init; }

    [JsonPropertyName("token_type")]
    public string? TokenType { get; init; }

    [JsonPropertyName("scope")]
    public string? Scope { get; init; }

    [JsonPropertyName("user_id")]
    public long UserId { get; init; }

    [JsonPropertyName("error")]
    public string? Error { get; init; }

    [JsonPropertyName("error_description")]
    public string? ErrorDescription { get; init; }
}

public sealed record NuvemshopProductPayload
{
    [JsonPropertyName("name")]
    public Dictionary<string, string> Name { get; init; } = new();

    [JsonPropertyName("description")]
    public Dictionary<string, string> Description { get; init; } = new();

    [JsonPropertyName("brand")]
    public string? Brand { get; init; }

    [JsonPropertyName("categories")]
    public List<long>? Categories { get; init; }

    [JsonPropertyName("variants")]
    public List<NuvemshopVariantPayload> Variants { get; init; } = new();

    [JsonPropertyName("images")]
    public List<NuvemshopImagePayload>? Images { get; init; }

    [JsonPropertyName("published")]
    public bool Published { get; init; } = true;

    [JsonPropertyName("free_shipping")]
    public bool FreeShipping { get; init; } = false;
}

public sealed record NuvemshopVariantPayload
{
    [JsonPropertyName("price")]
    public string Price { get; init; } = "0.00";

    [JsonPropertyName("promotional_price")]
    public string? PromotionalPrice { get; init; }

    [JsonPropertyName("stock")]
    public int Stock { get; init; }

    [JsonPropertyName("sku")]
    public string Sku { get; init; } = string.Empty;

    [JsonPropertyName("stock_management")]
    public bool StockManagement { get; init; } = true;

    [JsonPropertyName("weight")]
    public string? Weight { get; init; }

    [JsonPropertyName("width")]
    public string? Width { get; init; }

    [JsonPropertyName("height")]
    public string? Height { get; init; }

    [JsonPropertyName("depth")]
    public string? Depth { get; init; }
}

public sealed record NuvemshopImagePayload
{
    [JsonPropertyName("src")]
    public string Src { get; init; } = string.Empty;

    [JsonPropertyName("position")]
    public int? Position { get; init; }
}

public sealed record NuvemshopProductResponse
{
    [JsonPropertyName("id")]
    public long Id { get; init; }

    [JsonPropertyName("name")]
    public Dictionary<string, string>? Name { get; init; }

    [JsonPropertyName("variants")]
    public List<NuvemshopVariantResponse>? Variants { get; init; }
}

public sealed record NuvemshopVariantResponse
{
    [JsonPropertyName("id")]
    public long Id { get; init; }

    [JsonPropertyName("product_id")]
    public long ProductId { get; init; }

    [JsonPropertyName("sku")]
    public string? Sku { get; init; }

    [JsonPropertyName("price")]
    public string? Price { get; init; }

    [JsonPropertyName("stock")]
    public int? Stock { get; init; }
}

public sealed record NuvemshopLocationDto
{
    [JsonPropertyName("id")]
    public long Id { get; init; }

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("type")]
    public string Type { get; init; } = string.Empty;

    [JsonPropertyName("is_default")]
    public bool IsDefault { get; init; }
}

public sealed record NuvemshopSyncResultDto
{
    public bool Success { get; init; }
    public string? NuvemshopProductId { get; init; }
    public string? NuvemshopVariantId { get; init; }
    public string Message { get; init; } = string.Empty;
}

public sealed record NuvemshopWebhookPayload
{
    [JsonPropertyName("store_id")]
    public JsonElement StoreId { get; init; }

    [JsonPropertyName("event")]
    public string? Event { get; init; }

    [JsonPropertyName("id")]
    public JsonElement Id { get; init; }

    public string GetStoreIdString()
    {
        if (StoreId.ValueKind == JsonValueKind.Number)
            return StoreId.GetInt64().ToString();
        if (StoreId.ValueKind == JsonValueKind.String)
            return StoreId.GetString() ?? string.Empty;
        return string.Empty;
    }

    public string GetResourceIdString()
    {
        if (Id.ValueKind == JsonValueKind.Number)
            return Id.GetInt64().ToString();
        if (Id.ValueKind == JsonValueKind.String)
            return Id.GetString() ?? string.Empty;
        return string.Empty;
    }
}

public sealed record NuvemshopWebhookRegistrationPayload
{
    [JsonPropertyName("event")]
    public string Event { get; init; } = string.Empty;

    [JsonPropertyName("url")]
    public string Url { get; init; } = string.Empty;
}
