using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Ai;

/// <summary>
/// Estrutura de dados intermediária resultante do parsing do JSON gerado pelo LLM.
/// </summary>
public sealed record ProductEnrichmentAiContent
{
    [JsonPropertyName("title")]
    public string? Title { get; init; }

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("bullet_points")]
    public List<string>? BulletPoints { get; init; }

    [JsonPropertyName("seo_keywords")]
    public List<string>? SeoKeywords { get; init; }

    [JsonPropertyName("faqs")]
    public List<AiFaqItem>? Faqs { get; init; }
}

/// <summary>
/// Pergunta e resposta estruturada de FAQ gerada pela inteligência artificial.
/// </summary>
public sealed record AiFaqItem
{
    [JsonPropertyName("question")]
    public string? Question { get; init; }

    [JsonPropertyName("answer")]
    public string? Answer { get; init; }
}
