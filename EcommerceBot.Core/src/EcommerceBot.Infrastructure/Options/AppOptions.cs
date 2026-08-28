namespace EcommerceBot.Infrastructure.Options;

/// <summary>
/// Configurações gerais da aplicação (URLs base do backend e frontend).
/// </summary>
public class AppOptions
{
    public const string SectionName = "App";

    public string BaseUrl { get; set; } = "https://app.ecommercebot.com";
    public string FrontendUrl { get; set; } = "http://localhost:5173";
}
