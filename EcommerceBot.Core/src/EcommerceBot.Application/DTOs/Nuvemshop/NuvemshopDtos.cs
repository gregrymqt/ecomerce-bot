using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Nuvemshop;

public class NuvemshopCredentialsPayloadDto
{
    [JsonPropertyName("store_id")]
    public string StoreId { get; set; } = string.Empty;

    [JsonPropertyName("access_token")]
    public string AccessToken { get; set; } = string.Empty;
}

public class NuvemshopOAuthTokenResponse
{
    [JsonPropertyName("access_token")]
    public string? AccessToken { get; set; }

    [JsonPropertyName("token_type")]
    public string? TokenType { get; set; }

    [JsonPropertyName("scope")]
    public string? Scope { get; set; }

    [JsonPropertyName("user_id")]
    public long UserId { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }

    [JsonPropertyName("error_description")]
    public string? ErrorDescription { get; set; }
}

public class NuvemshopProductPayload
{
    [JsonPropertyName("name")]
    public Dictionary<string, string> Name { get; set; } = new();

    [JsonPropertyName("description")]
    public Dictionary<string, string> Description { get; set; } = new();

    [JsonPropertyName("brand")]
    public string? Brand { get; set; }

    [JsonPropertyName("categories")]
    public List<long>? Categories { get; set; }

    [JsonPropertyName("variants")]
    public List<NuvemshopVariantPayload> Variants { get; set; } = new();

    [JsonPropertyName("images")]
    public List<NuvemshopImagePayload>? Images { get; set; }

    [JsonPropertyName("published")]
    public bool Published { get; set; } = true;

    [JsonPropertyName("free_shipping")]
    public bool FreeShipping { get; set; } = false;
}

public class NuvemshopVariantPayload
{
    [JsonPropertyName("price")]
    public string Price { get; set; } = "0.00";

    [JsonPropertyName("promotional_price")]
    public string? PromotionalPrice { get; set; }

    [JsonPropertyName("stock")]
    public int Stock { get; set; }

    [JsonPropertyName("sku")]
    public string Sku { get; set; } = string.Empty;

    [JsonPropertyName("stock_management")]
    public bool StockManagement { get; set; } = true;

    [JsonPropertyName("weight")]
    public string? Weight { get; set; }

    [JsonPropertyName("width")]
    public string? Width { get; set; }

    [JsonPropertyName("height")]
    public string? Height { get; set; }

    [JsonPropertyName("depth")]
    public string? Depth { get; set; }
}

public class NuvemshopImagePayload
{
    [JsonPropertyName("src")]
    public string Src { get; set; } = string.Empty;

    [JsonPropertyName("position")]
    public int? Position { get; set; }
}

public class NuvemshopProductResponse
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("name")]
    public Dictionary<string, string>? Name { get; set; }

    [JsonPropertyName("variants")]
    public List<NuvemshopVariantResponse>? Variants { get; set; }
}

public class NuvemshopVariantResponse
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("product_id")]
    public long ProductId { get; set; }

    [JsonPropertyName("sku")]
    public string? Sku { get; set; }

    [JsonPropertyName("price")]
    public string? Price { get; set; }

    [JsonPropertyName("stock")]
    public int? Stock { get; set; }
}

public class NuvemshopLocationDto
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("is_default")]
    public bool IsDefault { get; set; }
}

public class NuvemshopSyncResultDto
{
    public bool Success { get; set; }
    public string? NuvemshopProductId { get; set; }
    public string? NuvemshopVariantId { get; set; }
    public string Message { get; set; } = string.Empty;
}
