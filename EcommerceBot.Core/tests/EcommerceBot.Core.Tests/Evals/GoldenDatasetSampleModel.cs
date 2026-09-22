using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace EcommerceBot.Core.Tests.Evals;

/// <summary>
/// Modelo de dados para carregamento e deserialização das amostras do Golden Dataset.
/// </summary>
public sealed class GoldenDatasetSampleModel
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("category")]
    public string Category { get; set; } = string.Empty;

    [JsonPropertyName("input")]
    public GoldenInputModel Input { get; set; } = new();

    [JsonPropertyName("expected_output")]
    public GoldenOutputModel ExpectedOutput { get; set; } = new();
}

public sealed class GoldenInputModel
{
    [JsonPropertyName("tenantId")]
    public Guid TenantId { get; set; }

    [JsonPropertyName("sku")]
    public string Sku { get; set; } = string.Empty;

    [JsonPropertyName("url")]
    public string Url { get; set; } = string.Empty;

    [JsonPropertyName("rawTitle")]
    public string RawTitle { get; set; } = string.Empty;

    [JsonPropertyName("rawMarkdown")]
    public string RawMarkdown { get; set; } = string.Empty;

    [JsonPropertyName("price")]
    public decimal? Price { get; set; }

    [JsonPropertyName("currency")]
    public string Currency { get; set; } = "BRL";

    [JsonPropertyName("metaAttributes")]
    public Dictionary<string, string> MetaAttributes { get; set; } = new();

    [JsonPropertyName("promptContext")]
    public string PromptContext { get; set; } = string.Empty;
}

public sealed class GoldenOutputModel
{
    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("bullet_points")]
    public List<string> BulletPoints { get; set; } = new();

    [JsonPropertyName("seo_keywords")]
    public List<string> SeoKeywords { get; set; } = new();

    [JsonPropertyName("faqs")]
    public List<GoldenFaqModel> Faqs { get; set; } = new();
}

public sealed class GoldenFaqModel
{
    [JsonPropertyName("question")]
    public string Question { get; set; } = string.Empty;

    [JsonPropertyName("answer")]
    public string Answer { get; set; } = string.Empty;
}
