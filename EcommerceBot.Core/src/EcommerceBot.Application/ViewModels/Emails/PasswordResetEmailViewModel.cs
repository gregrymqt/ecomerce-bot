using System;

namespace EcommerceBot.Application.ViewModels.Emails;

public sealed record PasswordResetEmailViewModel
{
    public string RecipientName { get; init; } = string.Empty;
    public string ResetUrl { get; init; } = string.Empty;
    public string ExpiresInMinutes { get; init; } = "15";
    public string Year { get; init; } = DateTime.UtcNow.Year.ToString();
}
