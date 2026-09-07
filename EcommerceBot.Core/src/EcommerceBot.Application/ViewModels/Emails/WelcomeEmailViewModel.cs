using System;

namespace EcommerceBot.Application.ViewModels.Emails;

public sealed record WelcomeEmailViewModel
{
    public string RecipientName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string LoginUrl { get; init; } = "https://app.ecommercebot.com/login";
    public string Year { get; init; } = DateTime.UtcNow.Year.ToString();
}
