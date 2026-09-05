using System;

namespace EcommerceBot.Application.ViewModels.Emails;

public class PasswordResetEmailViewModel
{
    public string RecipientName { get; set; } = string.Empty;
    public string ResetUrl { get; set; } = string.Empty;
    public string ExpiresInMinutes { get; set; } = "15";
    public string Year { get; set; } = DateTime.UtcNow.Year.ToString();
}
