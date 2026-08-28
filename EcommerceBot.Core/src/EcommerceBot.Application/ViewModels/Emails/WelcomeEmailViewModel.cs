using System;

namespace EcommerceBot.Application.ViewModels.Emails;

public class WelcomeEmailViewModel
{
    public string RecipientName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string LoginUrl { get; set; } = "https://app.ecommercebot.com/login";
    public string Year { get; set; } = DateTime.UtcNow.Year.ToString();
}
