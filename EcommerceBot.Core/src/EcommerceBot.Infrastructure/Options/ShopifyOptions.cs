namespace EcommerceBot.Infrastructure.Options;

/// <summary>
/// Configurações da integração e-commerce Shopify (GraphQL & OAuth).
/// </summary>
public class ShopifyOptions
{
    public const string SectionName = "Shopify";

    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
    public string Scopes { get; set; } = "read_products,write_products,read_inventory,write_inventory";
    public string RedirectUri { get; set; } = "https://app.ecommercebot.com/api/v1/shopify/oauth/callback";
    public string ApiVersion { get; set; } = "2026-07";
    public string AppUrl { get; set; } = "https://app.ecommercebot.com";
}
