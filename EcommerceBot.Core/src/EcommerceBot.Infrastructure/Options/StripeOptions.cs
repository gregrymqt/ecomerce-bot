using System;

namespace EcommerceBot.Infrastructure.Options;

/// <summary>
/// Configurações do Gateway de Pagamento Stripe (Payments, Billing, Tax, Invoicing).
/// </summary>
public sealed class StripeOptions
{
    public const string SectionName = "Stripe";

    public string SecretKey { get; set; } = string.Empty;
    public string PublishableKey { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;

    /// <summary>
    /// Validação estrita (fail-closed) para evitar subida da aplicação com chaves ausentes.
    /// </summary>
    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(SecretKey))
        {
            throw new InvalidOperationException("Stripe:SecretKey is required.");
        }

        if (string.IsNullOrWhiteSpace(PublishableKey))
        {
            throw new InvalidOperationException("Stripe:PublishableKey is required.");
        }
    }
}
