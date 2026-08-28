using System;

namespace EcommerceBot.Application.ViewModels.Emails;

public class LowBalanceEmailViewModel
{
    public string RecipientName { get; set; } = string.Empty;
    public decimal CurrentBalance { get; set; }
    public decimal Threshold { get; set; } = 10.00m;
    public string Currency { get; set; } = "BRL";
    public string RechargeUrl { get; set; } = "https://app.ecommercebot.com/wallet";
    public string Year { get; set; } = DateTime.UtcNow.Year.ToString();
}
