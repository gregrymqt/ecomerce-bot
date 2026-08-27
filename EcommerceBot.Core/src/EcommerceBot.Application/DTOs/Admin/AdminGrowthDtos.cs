using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Admin;

public class RecordSaasVisitRequestDto
{
    [JsonPropertyName("session_id")]
    public string SessionId { get; set; } = string.Empty;

    [JsonPropertyName("path")]
    public string Path { get; set; } = "/";

    [JsonPropertyName("utm_source")]
    public string? UtmSource { get; set; }

    [JsonPropertyName("utm_medium")]
    public string? UtmMedium { get; set; }

    [JsonPropertyName("utm_campaign")]
    public string? UtmCampaign { get; set; }

    [JsonPropertyName("utm_content")]
    public string? UtmContent { get; set; }

    [JsonPropertyName("utm_term")]
    public string? UtmTerm { get; set; }

    [JsonPropertyName("ad_id")]
    public string? AdId { get; set; }

    [JsonPropertyName("fbclid")]
    public string? FbClid { get; set; }

    [JsonPropertyName("gclid")]
    public string? GClid { get; set; }

    [JsonPropertyName("referrer")]
    public string? Referrer { get; set; }
}

public class AcquisitionFunnelResponseDto
{
    [JsonPropertyName("total_visitors")]
    public int TotalVisitors { get; set; }

    [JsonPropertyName("total_signups")]
    public int TotalSignups { get; set; }

    [JsonPropertyName("total_paying_customers")]
    public int TotalPayingCustomers { get; set; }

    [JsonPropertyName("visitor_to_signup_rate")]
    public decimal VisitorToSignupRate { get; set; }

    [JsonPropertyName("signup_to_paid_rate")]
    public decimal SignupToPaidRate { get; set; }

    [JsonPropertyName("overall_conversion_rate")]
    public decimal OverallConversionRate { get; set; }

    [JsonPropertyName("period_days")]
    public int PeriodDays { get; set; }
}

public class CampaignPerformanceRowDto
{
    [JsonPropertyName("utm_source")]
    public string UtmSource { get; set; } = string.Empty;

    [JsonPropertyName("utm_campaign")]
    public string UtmCampaign { get; set; } = string.Empty;

    [JsonPropertyName("ad_id")]
    public string? AdId { get; set; }

    [JsonPropertyName("visitors_count")]
    public int VisitorsCount { get; set; }

    [JsonPropertyName("signups_count")]
    public int SignupsCount { get; set; }

    [JsonPropertyName("paying_customers_count")]
    public int PayingCustomersCount { get; set; }

    [JsonPropertyName("gross_revenue_brl")]
    public decimal GrossRevenueBrl { get; set; }

    [JsonPropertyName("llm_cost_brl")]
    public decimal LlmCostBrl { get; set; }

    [JsonPropertyName("ad_spend_brl")]
    public decimal AdSpendBrl { get; set; }

    [JsonPropertyName("net_margin_brl")]
    public decimal NetMarginBrl { get; set; }

    [JsonPropertyName("roas")]
    public decimal Roas { get; set; }

    [JsonPropertyName("cac_brl")]
    public decimal CacBrl { get; set; }
}

public class UnitEconomicsResponseDto
{
    [JsonPropertyName("total_ad_spend_brl")]
    public decimal TotalAdSpendBrl { get; set; }

    [JsonPropertyName("total_gross_revenue_brl")]
    public decimal TotalGrossRevenueBrl { get; set; }

    [JsonPropertyName("total_llm_cost_brl")]
    public decimal TotalLlmCostBrl { get; set; }

    [JsonPropertyName("net_profit_brl")]
    public decimal NetProfitBrl { get; set; }

    [JsonPropertyName("average_cac_brl")]
    public decimal AverageCacBrl { get; set; }

    [JsonPropertyName("average_ltv_brl")]
    public decimal AverageLtvBrl { get; set; }

    [JsonPropertyName("ltv_cac_ratio")]
    public decimal LtvCacRatio { get; set; }

    [JsonPropertyName("payback_months")]
    public decimal PaybackMonths { get; set; }

    [JsonPropertyName("campaigns")]
    public List<CampaignPerformanceRowDto> Campaigns { get; set; } = new();
}

public class CreateAdSpendRequestDto
{
    [JsonPropertyName("campaign_name")]
    public string CampaignName { get; set; } = string.Empty;

    [JsonPropertyName("utm_source")]
    public string UtmSource { get; set; } = "meta_ads";

    [JsonPropertyName("ad_id")]
    public string? AdId { get; set; }

    [JsonPropertyName("amount_spent_brl")]
    public decimal AmountSpentBrl { get; set; }

    [JsonPropertyName("period_start")]
    public DateTimeOffset PeriodStart { get; set; }

    [JsonPropertyName("period_end")]
    public DateTimeOffset PeriodEnd { get; set; }

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }
}
