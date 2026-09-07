using System;

namespace EcommerceBot.Application.ViewModels.Emails;

public sealed record SyncFailedEmailViewModel
{
    public string RecipientName { get; init; } = string.Empty;
    public string PlatformName { get; init; } = "Shopify";
    public string ErrorMessage { get; init; } = string.Empty;
    public string ReconnectUrl { get; init; } = "https://app.ecommercebot.com/integrations";
    public string Year { get; init; } = DateTime.UtcNow.Year.ToString();
}
