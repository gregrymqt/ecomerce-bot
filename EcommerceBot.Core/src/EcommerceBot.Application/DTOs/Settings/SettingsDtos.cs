using System;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Settings;

public sealed record AiSettingsDto
{
    [JsonPropertyName("tone_of_voice")]
    public string ToneOfVoice { get; init; } = "persuasivo";

    [JsonPropertyName("target_language")]
    public string TargetLanguage { get; init; } = "pt-BR";

    [JsonPropertyName("seo_tags_enabled")]
    public bool SeoTagsEnabled { get; init; } = true;

    [JsonPropertyName("custom_instructions")]
    public string? CustomInstructions { get; init; }
}

public sealed record PricingSettingsDto
{
    [JsonPropertyName("margin_percentage")]
    public double MarginPercentage { get; init; } = 0.0;

    [JsonPropertyName("round_cents")]
    public bool RoundCents { get; init; } = true;
}

public sealed record StoreProfileDto
{
    [JsonPropertyName("store_name")]
    public string? StoreName { get; init; }

    [JsonPropertyName("niche")]
    public string? Niche { get; init; }

    [JsonPropertyName("support_email")]
    public string? SupportEmail { get; init; }
}

public sealed record TenantSettingsResponse
{
    [JsonPropertyName("tenant_id")]
    public string TenantId { get; init; } = string.Empty;

    [JsonPropertyName("ai_settings")]
    public AiSettingsDto AiSettings { get; init; } = new();

    [JsonPropertyName("pricing_settings")]
    public PricingSettingsDto PricingSettings { get; init; } = new();

    [JsonPropertyName("store_profile")]
    public StoreProfileDto StoreProfile { get; init; } = new();

    [JsonPropertyName("updated_at")]
    public DateTimeOffset? UpdatedAt { get; init; }
}

public sealed record TenantSettingsUpdate
{
    [JsonPropertyName("ai_settings")]
    public AiSettingsDto? AiSettings { get; init; }

    [JsonPropertyName("pricing_settings")]
    public PricingSettingsDto? PricingSettings { get; init; }

    [JsonPropertyName("store_profile")]
    public StoreProfileDto? StoreProfile { get; init; }
}
