using System;

namespace EcommerceBot.Application.ViewModels.Emails;

public sealed record ScrapingCompletedEmailViewModel
{
    public string RecipientName { get; init; } = string.Empty;
    public int TotalProducts { get; init; }
    public int SuccessCount { get; init; }
    public int FailedCount { get; init; }
    public string CatalogUrl { get; init; } = "https://app.ecommercebot.com/catalog";
    public string Year { get; init; } = DateTime.UtcNow.Year.ToString();
}
