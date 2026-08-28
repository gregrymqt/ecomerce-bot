namespace EcommerceBot.Infrastructure.Options;

/// <summary>
/// Configurações do canal de alertas críticos via Discord Webhook.
/// </summary>
public class DiscordOptions
{
    public const string SectionName = "Discord";

    public string WebhookUrl { get; set; } = string.Empty;
    public bool Enabled { get; set; } = true;
}
