using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Messaging;

/// <summary>
/// Metadados estruturados resultantes da extração e enriquecimento do produto gerados pelo Python Worker.
/// Espelha o schema Pydantic ProductEnrichmentMetadata.
/// </summary>
public sealed record ProductEnrichmentMetadata
{
    [JsonPropertyName("price")]
    public double? Price { get; init; }

    [JsonPropertyName("brand")]
    public string? Brand { get; init; }

    [JsonPropertyName("category")]
    public string? Category { get; init; }

    [JsonPropertyName("model_used")]
    public string? ModelUsed { get; init; }

    [JsonPropertyName("images")]
    public List<string> Images { get; init; } = new();
}
