using System;

namespace EcommerceBot.Application.ViewModels.Emails;

public class SyncFailedEmailViewModel
{
    public string RecipientName { get; set; } = string.Empty;
    public string PlatformName { get; set; } = "Shopify";
    public string ErrorMessage { get; set; } = string.Empty;
    public string ReconnectUrl { get; set; } = "https://app.ecommercebot.com/integrations";
    public string Year { get; set; } = DateTime.UtcNow.Year.ToString();
}
