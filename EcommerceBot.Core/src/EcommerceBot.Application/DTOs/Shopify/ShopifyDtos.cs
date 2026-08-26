using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Shopify;

public class ShopifyOAuthRequest
{
    public string Code { get; set; } = string.Empty;
    public string Shop { get; set; } = string.Empty;
    public string? State { get; set; }
}

public class ShopifyTokenResponse
{
    [JsonPropertyName("access_token")]
    public string AccessToken { get; set; } = string.Empty;

    [JsonPropertyName("scope")]
    public string Scope { get; set; } = string.Empty;
}
