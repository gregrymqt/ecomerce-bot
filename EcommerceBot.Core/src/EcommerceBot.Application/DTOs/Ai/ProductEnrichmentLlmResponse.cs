using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.Ai;

/// <summary>
/// Item de FAQ gerado pela inteligência artificial para sanar objeções do comprador.
/// </summary>
public sealed record ProductFaqItem(string Question, string Answer);

/// <summary>
/// Resposta tipada estruturada retornada pelo OpenRouter Gateway contendo o copywriting persuasivo,
/// elementos de CRO/SEO e telemetria de consumo de tokens.
/// </summary>
public sealed record ProductEnrichmentLlmResponse
{
    public string Title { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public List<string> BulletPoints { get; init; } = new();
    public List<string> SeoKeywords { get; init; } = new();
    public List<ProductFaqItem> Faqs { get; init; } = new();
    public int PromptTokens { get; init; }
    public int CompletionTokens { get; init; }
    public int TotalTokens => PromptTokens + CompletionTokens;
    public decimal TotalCostEstimated { get; init; }
    public string ModelUsed { get; init; } = string.Empty;
    public long? ExecutionTimeMs { get; init; }
    public bool IsFallback { get; init; }
    public string? ErrorMessage { get; init; }
}
