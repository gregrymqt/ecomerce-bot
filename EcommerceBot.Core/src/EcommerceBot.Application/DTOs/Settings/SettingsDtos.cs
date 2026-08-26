using System;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Settings;

public class AiSettingsDto
{
    [JsonPropertyName("tone_of_voice")]
    public string ToneOfVoice { get; set; } = "persuasivo";

    [JsonPropertyName("target_language")]
    public string TargetLanguage { get; set; } = "pt-BR";

    [JsonPropertyName("seo_tags_enabled")]
    public bool SeoTagsEnabled { get; set; } = true;

    [JsonPropertyName("custom_instructions")]
    public string? CustomInstructions { get; set; }
}

public class PricingSettingsDto
{
    [JsonPropertyName("margin_percentage")]
    public double MarginPercentage { get; set; } = 0.0;

    [JsonPropertyName("round_cents")]
    public bool RoundCents { get; set; } = true;
}

public class StoreProfileDto
{
    [JsonPropertyName("store_name")]
    public string? StoreName { get; set; }

    [JsonPropertyName("niche")]
    public string? Niche { get; set; }

    [JsonPropertyName("support_email")]
    public string? SupportEmail { get; set; }
}

public class TenantSettingsResponse
{
    [JsonPropertyName("tenant_id")]
    public string TenantId { get; set; } = string.Empty;

    [JsonPropertyName("ai_settings")]
    public AiSettingsDto AiSettings { get; set; } = new AiSettingsDto();

    [JsonPropertyName("pricing_settings")]
    public PricingSettingsDto PricingSettings { get; set; } = new PricingSettingsDto();

    [JsonPropertyName("store_profile")]
    public StoreProfileDto StoreProfile { get; set; } = new StoreProfileDto();

    [JsonPropertyName("updated_at")]
    public DateTimeOffset? UpdatedAt { get; set; }
}

public class TenantSettingsUpdate
{
    [JsonPropertyName("ai_settings")]
    public AiSettingsDto? AiSettings { get; set; }

    [JsonPropertyName("pricing_settings")]
    public PricingSettingsDto? PricingSettings { get; set; }

    [JsonPropertyName("store_profile")]
    public StoreProfileDto? StoreProfile { get; set; }
}
