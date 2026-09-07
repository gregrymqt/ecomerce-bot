using System;

namespace EcommerceBot.Application.ViewModels.Emails;

public sealed record PaymentApprovedEmailViewModel
{
    public string RecipientName { get; init; } = string.Empty;
    public string PackageName { get; init; } = "Recarga de Créditos IA";
    public int CreditsAdded { get; init; }
    public int NewBalance { get; init; }
    public decimal Amount { get; init; }
    public string Currency { get; init; } = "BRL";
    public string PaymentMethod { get; init; } = "PIX";
    public string TransactionId { get; init; } = string.Empty;
    public string DashboardUrl { get; init; } = "https://app.ecommercebot.com/dashboard";
    public string Year { get; init; } = DateTime.UtcNow.Year.ToString();

    // Propriedade de compatibilidade
    public string PlanName
    {
        get => PackageName;
        init => PackageName = value;
    }
}
