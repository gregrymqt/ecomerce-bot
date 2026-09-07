using System;

namespace EcommerceBot.Application.ViewModels.Emails;

public sealed record LowBalanceEmailViewModel
{
    public string RecipientName { get; init; } = string.Empty;
    public decimal CurrentBalance { get; init; }
    public decimal Threshold { get; init; } = 10.00m;
    public string Currency { get; init; } = "BRL";
    public string RechargeUrl { get; init; } = "https://app.ecommercebot.com/wallet";
    public string Year { get; init; } = DateTime.UtcNow.Year.ToString();
}
