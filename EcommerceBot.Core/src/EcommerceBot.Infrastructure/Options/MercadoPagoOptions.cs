namespace EcommerceBot.Infrastructure.Options;

/// <summary>
/// Configurações do Gateway de Pagamento Mercado Pago.
/// </summary>
public class MercadoPagoOptions
{
    public const string SectionName = "MercadoPago";

    public string AccessToken { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
    public string? PublicKey { get; set; }
}
