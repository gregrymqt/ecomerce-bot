namespace EcommerceBot.Infrastructure.Options;

/// <summary>
/// Configurações do provedor de autenticação Google OAuth 2.0.
/// </summary>
public class GoogleAuthOptions
{
    public const string SectionName = "Google";

    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = "http://localhost:5173/auth/google/callback";
}
