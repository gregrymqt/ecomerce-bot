using System;

namespace EcommerceBot.Application.ViewModels.Emails;

public class PaymentApprovedEmailViewModel
{
    public string RecipientName { get; set; } = string.Empty;
    public string PackageName { get; set; } = "Recarga de Créditos IA";
    public int CreditsAdded { get; set; }
    public int NewBalance { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "BRL";
    public string PaymentMethod { get; set; } = "PIX";
    public string TransactionId { get; set; } = string.Empty;
    public string DashboardUrl { get; set; } = "https://app.ecommercebot.com/dashboard";
    public string Year { get; set; } = DateTime.UtcNow.Year.ToString();

    // Propriedade de compatibilidade
    public string PlanName
    {
        get => PackageName;
        set => PackageName = value;
    }
}
