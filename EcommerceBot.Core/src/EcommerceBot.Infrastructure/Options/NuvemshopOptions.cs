namespace EcommerceBot.Infrastructure.Options;

/// <summary>
/// Configurações da integração e-commerce Nuvemshop (REST & OAuth).
/// </summary>
public class NuvemshopOptions
{
    public const string SectionName = "Nuvemshop";

    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = "https://app.ecommercebot.com/api/v1/nuvemshop/oauth/callback";
    public string WebhookCallbackUrl { get; set; } = "https://app.ecommercebot.com/api/v1/nuvemshop/webhooks";
    public string Scopes { get; set; } = "write_products,read_products,write_orders,read_orders";
}
