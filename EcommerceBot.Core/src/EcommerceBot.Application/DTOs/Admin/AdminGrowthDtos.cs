using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Admin;

public sealed record RecordSaasVisitRequestDto
{
    [JsonPropertyName("session_id")]
    public string SessionId { get; init; } = string.Empty;

    [JsonPropertyName("path")]
    public string Path { get; init; } = "/";

    [JsonPropertyName("utm_source")]
    public string? UtmSource { get; init; }

    [JsonPropertyName("utm_medium")]
    public string? UtmMedium { get; init; }

    [JsonPropertyName("utm_campaign")]
    public string? UtmCampaign { get; init; }

    [JsonPropertyName("utm_content")]
    public string? UtmContent { get; init; }

    [JsonPropertyName("utm_term")]
    public string? UtmTerm { get; init; }

    [JsonPropertyName("ad_id")]
    public string? AdId { get; init; }

    [JsonPropertyName("fbclid")]
    public string? FbClid { get; init; }

    [JsonPropertyName("gclid")]
    public string? GClid { get; init; }

    [JsonPropertyName("referrer")]
    public string? Referrer { get; init; }
}

public sealed record AcquisitionFunnelResponseDto
{
    [JsonPropertyName("total_visitors")]
    public int TotalVisitors { get; init; }

    [JsonPropertyName("total_signups")]
    public int TotalSignups { get; init; }

    [JsonPropertyName("total_paying_customers")]
    public int TotalPayingCustomers { get; init; }

    [JsonPropertyName("visitor_to_signup_rate")]
    public decimal VisitorToSignupRate { get; init; }

    [JsonPropertyName("signup_to_paid_rate")]
    public decimal SignupToPaidRate { get; init; }

    [JsonPropertyName("overall_conversion_rate")]
    public decimal OverallConversionRate { get; init; }

    [JsonPropertyName("period_days")]
    public int PeriodDays { get; init; }
}

public sealed record CampaignPerformanceRowDto
{
    [JsonPropertyName("utm_source")]
    public string UtmSource { get; init; } = string.Empty;

    [JsonPropertyName("utm_campaign")]
    public string UtmCampaign { get; init; } = string.Empty;

    [JsonPropertyName("ad_id")]
    public string? AdId { get; init; }

    [JsonPropertyName("visitors_count")]
    public int VisitorsCount { get; init; }

    [JsonPropertyName("signups_count")]
    public int SignupsCount { get; init; }

    [JsonPropertyName("paying_customers_count")]
    public int PayingCustomersCount { get; init; }

    [JsonPropertyName("gross_revenue_brl")]
    public decimal GrossRevenueBrl { get; init; }

    [JsonPropertyName("llm_cost_brl")]
    public decimal LlmCostBrl { get; init; }

    [JsonPropertyName("ad_spend_brl")]
    public decimal AdSpendBrl { get; init; }

    [JsonPropertyName("net_margin_brl")]
    public decimal NetMarginBrl { get; init; }

    [JsonPropertyName("roas")]
    public decimal Roas { get; init; }

    [JsonPropertyName("cac_brl")]
    public decimal CacBrl { get; init; }
}

public sealed record UnitEconomicsResponseDto
{
    [JsonPropertyName("total_ad_spend_brl")]
    public decimal TotalAdSpendBrl { get; init; }

    [JsonPropertyName("total_gross_revenue_brl")]
    public decimal TotalGrossRevenueBrl { get; init; }

    [JsonPropertyName("total_llm_cost_brl")]
    public decimal TotalLlmCostBrl { get; init; }

    [JsonPropertyName("net_profit_brl")]
    public decimal NetProfitBrl { get; init; }

    [JsonPropertyName("average_cac_brl")]
    public decimal AverageCacBrl { get; init; }

    [JsonPropertyName("average_ltv_brl")]
    public decimal AverageLtvBrl { get; init; }

    [JsonPropertyName("ltv_cac_ratio")]
    public decimal LtvCacRatio { get; init; }

    [JsonPropertyName("payback_months")]
    public decimal PaybackMonths { get; init; }

    [JsonPropertyName("campaigns")]
    public List<CampaignPerformanceRowDto> Campaigns { get; init; } = new();
}

public sealed record CreateAdSpendRequestDto
{
    [JsonPropertyName("campaign_name")]
    public string CampaignName { get; init; } = string.Empty;

    [JsonPropertyName("utm_source")]
    public string UtmSource { get; init; } = "meta_ads";

    [JsonPropertyName("ad_id")]
    public string? AdId { get; init; }

    [JsonPropertyName("amount_spent_brl")]
    public decimal AmountSpentBrl { get; init; }

    [JsonPropertyName("period_start")]
    public DateTimeOffset PeriodStart { get; init; }

    [JsonPropertyName("period_end")]
    public DateTimeOffset PeriodEnd { get; init; }

    [JsonPropertyName("notes")]
    public string? Notes { get; init; }
}
