namespace EcommerceBot.Infrastructure.Options;

/// <summary>
/// Configurações tipadas do Gateway OpenRouter para orquestração de LLMs e copywriting persuasivo.
/// </summary>
public sealed class OpenRouterOptions
{
    public const string SectionName = "OpenRouter";

    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://openrouter.ai/api/v1";
    public string DefaultModel { get; set; } = "deepseek/deepseek-chat";
    public int TimeoutSeconds { get; set; } = 60;
}
