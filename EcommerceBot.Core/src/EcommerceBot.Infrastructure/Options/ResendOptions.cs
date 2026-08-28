namespace EcommerceBot.Infrastructure.Options;

/// <summary>
/// Configurações do serviço de e-mail transacional Resend.
/// </summary>
public class ResendOptions
{
    public const string SectionName = "Resend";

    public string ApiKey { get; set; } = "re_test123";
    public string WebhookSecret { get; set; } = string.Empty;
    public string FromEmail { get; set; } = "ECom AutoBot <notificacoes@ecommercebot.com>";
}
