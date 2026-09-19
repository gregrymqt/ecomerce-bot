using System;
using System.Text.Json;
using System.Text.Json.Serialization;
using EcommerceBot.Application.DTOs.Ai;
using EcommerceBot.Application.Interfaces.Services;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

/// <summary>
/// Serviço de aplicação especializado na extração defensiva e parsing de payloads JSON
/// encapsulados em respostas de modelos de linguagem generativa.
/// </summary>
public sealed class LlmContentParserService : ILlmContentParserService
{
    private readonly ILogger<LlmContentParserService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public LlmContentParserService(ILogger<LlmContentParserService> logger)
    {
        _logger = logger;
    }

    public ProductEnrichmentAiContent? ParseContent(string? rawContent)
    {
        if (string.IsNullOrWhiteSpace(rawContent))
        {
            return null;
        }

        try
        {
            var cleanedJson = ExtractJson(rawContent);
            if (string.IsNullOrWhiteSpace(cleanedJson))
            {
                return null;
            }

            return JsonSerializer.Deserialize<ProductEnrichmentAiContent>(cleanedJson, JsonOptions);
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "[LlmContentParserService] Falha ao deserializar JSON gerado pelo LLM. Conteúdo: {RawContent}", rawContent);
            return null;
        }
    }

    private static string ExtractJson(string rawContent)
    {
        var trimmed = rawContent.Trim();

        if (trimmed.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed["```json".Length..].Trim();
        }
        else if (trimmed.StartsWith("```", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed["```".Length..].Trim();
        }

        if (trimmed.EndsWith("```", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed[..^"```".Length].Trim();
        }

        var firstBrace = trimmed.IndexOf('{');
        var lastBrace = trimmed.LastIndexOf('}');

        if (firstBrace >= 0 && lastBrace > firstBrace)
        {
            return trimmed.Substring(firstBrace, lastBrace - firstBrace + 1);
        }

        return trimmed;
    }
}
