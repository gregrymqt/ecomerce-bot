using System;

namespace EcommerceBot.Application.ViewModels.Emails;

public class ScrapingCompletedEmailViewModel
{
    public string RecipientName { get; set; } = string.Empty;
    public int TotalProducts { get; set; }
    public int SuccessCount { get; set; }
    public int FailedCount { get; set; }
    public string CatalogUrl { get; set; } = "https://app.ecommercebot.com/catalog";
    public string Year { get; set; } = DateTime.UtcNow.Year.ToString();
}
