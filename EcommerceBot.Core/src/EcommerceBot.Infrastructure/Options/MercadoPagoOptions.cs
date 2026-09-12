namespace EcommerceBot.Infrastructure.Options;

/// <summary>
/// Configurações do Gateway de Pagamento Mercado Pago.
/// </summary>
public sealed class MercadoPagoOptions
{
    public const string SectionName = "MercadoPago";

    public string AccessToken { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
    public string? PublicKey { get; set; }
    public bool IsSandbox { get; set; }
    public string? SandboxPayerEmail { get; set; }
}
