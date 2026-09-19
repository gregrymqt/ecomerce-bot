using System;
using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.Messaging;

/// <summary>
/// Contrato de mensageria da fase intermediária emitido pelo worker Python após scraping evasivo bruto.
/// Consumido pelo Core API C# (ScrapedProductConsumer) para orquestração de LLM (OpenRouter),
/// copywriting persuasivo, estruturação de SEO, persistência via Dapper e emissão de telemetria.
/// </summary>
public sealed record ScrapedRawProductEvent
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
    public bool Success { get; init; } = true;
    public string? ErrorMessage { get; init; }
}
