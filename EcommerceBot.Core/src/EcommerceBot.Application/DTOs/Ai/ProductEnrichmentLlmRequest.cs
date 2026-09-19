using System;
using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.Ai;

/// <summary>
/// Requisição tipada para enriquecimento, copywriting persuasivo e SEO de produto via OpenRouter.
/// </summary>
public sealed record ProductEnrichmentLlmRequest
{
    public Guid TenantId { get; init; }
    public string Sku { get; init; } = string.Empty;
    public string Url { get; init; } = string.Empty;
    public string RawTitle { get; init; } = string.Empty;
    public string RawDescriptionHtml { get; init; } = string.Empty;
    public string RawMarkdown { get; init; } = string.Empty;
    public decimal? Price { get; init; }
    public string Currency { get; init; } = "BRL";
    public List<string> Images { get; init; } = new();
    public Dictionary<string, string> MetaAttributes { get; init; } = new();
    public string PromptContext { get; init; } = string.Empty;
    public string? CustomModel { get; init; }
}
