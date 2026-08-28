namespace EcommerceBot.Infrastructure.Options;

/// <summary>
/// Configurações de autenticação e emissão de tokens JWT.
/// </summary>
public class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Key { get; set; } = string.Empty;
    public string Issuer { get; set; } = "EcommerceBotApi";
    public string Audience { get; set; } = "EcommerceBotClient";
    public int ExpireMinutes { get; set; } = 1440;
}
