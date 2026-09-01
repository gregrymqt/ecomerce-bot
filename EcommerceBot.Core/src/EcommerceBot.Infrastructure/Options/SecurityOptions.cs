namespace EcommerceBot.Infrastructure.Options;

/// <summary>
/// Configurações de chaves mestres de segurança e criptografia.
/// </summary>
public class SecurityOptions
{
    public const string SectionName = "Security";

    public string AesMasterKey { get; set; } = string.Empty;
    public string InternalServiceKey { get; set; } = string.Empty;
    public string SuperAdminEmails { get; set; } = string.Empty;
}
