using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Analytics;

public class RecordTenantVisitRequestDto
{
    [JsonPropertyName("tenant_id")]
    public Guid TenantId { get; set; }

    [JsonPropertyName("session_id")]
    public string SessionId { get; set; } = string.Empty;

    [JsonPropertyName("utm_source")]
    public string? UtmSource { get; set; }

    [JsonPropertyName("utm_medium")]
    public string? UtmMedium { get; set; }

    [JsonPropertyName("utm_campaign")]
    public string? UtmCampaign { get; set; }

    [JsonPropertyName("utm_term")]
    public string? UtmTerm { get; set; }

    [JsonPropertyName("utm_content")]
    public string? UtmContent { get; set; }

    [JsonPropertyName("ad_id")]
    public string? AdId { get; set; }

    [JsonPropertyName("fbclid")]
    public string? FbClid { get; set; }

    [JsonPropertyName("gclid")]
    public string? GClid { get; set; }
}

public class CreativePerformanceDto
{
    [JsonPropertyName("ad_id")]
    public string AdId { get; set; } = string.Empty;

    [JsonPropertyName("campaign")]
    public string Campaign { get; set; } = string.Empty;

    [JsonPropertyName("source")]
    public string Source { get; set; } = string.Empty;

    [JsonPropertyName("orders_count")]
    public int OrdersCount { get; set; }

    [JsonPropertyName("total_revenue_brl")]
    public decimal TotalRevenueBrl { get; set; }

    [JsonPropertyName("average_ticket_brl")]
    public decimal AverageTicketBrl { get; set; }
}

public class SourcePerformanceDto
{
    [JsonPropertyName("source")]
    public string Source { get; set; } = string.Empty;

    [JsonPropertyName("visits_count")]
    public int VisitsCount { get; set; }

    [JsonPropertyName("orders_count")]
    public int OrdersCount { get; set; }

    [JsonPropertyName("conversion_rate")]
    public decimal ConversionRate { get; set; }

    [JsonPropertyName("revenue_brl")]
    public decimal RevenueBrl { get; set; }
}

public class TenantTrafficOverviewDto
{
    [JsonPropertyName("total_attributed_revenue_brl")]
    public decimal TotalAttributedRevenueBrl { get; set; }

    [JsonPropertyName("total_tracked_orders")]
    public int TotalTrackedOrders { get; set; }

    [JsonPropertyName("total_visits")]
    public int TotalVisits { get; set; }

    [JsonPropertyName("average_ticket_brl")]
    public decimal AverageTicketBrl { get; set; }

    [JsonPropertyName("top_source")]
    public string TopSource { get; set; } = "Direto / Orgânico";

    [JsonPropertyName("period_days")]
    public int PeriodDays { get; set; }

    [JsonPropertyName("sources")]
    public List<SourcePerformanceDto> Sources { get; set; } = new();

    [JsonPropertyName("creatives")]
    public List<CreativePerformanceDto> Creatives { get; set; } = new();
}

public class VerifyTagRequestDto
{
    [JsonPropertyName("store_url")]
    public string StoreUrl { get; set; } = string.Empty;
}

public class VerifyTagResponseDto
{
    [JsonPropertyName("is_installed")]
    public bool IsInstalled { get; set; }

    [JsonPropertyName("store_url")]
    public string StoreUrl { get; set; } = string.Empty;

    [JsonPropertyName("checked_at")]
    public DateTimeOffset CheckedAt { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;
}
