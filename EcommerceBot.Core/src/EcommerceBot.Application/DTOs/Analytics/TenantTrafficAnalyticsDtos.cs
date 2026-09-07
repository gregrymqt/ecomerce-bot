using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Analytics;

public sealed record RecordTenantVisitRequestDto
{
    [JsonPropertyName("tenant_id")]
    public Guid TenantId { get; init; }

    [JsonPropertyName("session_id")]
    public string SessionId { get; init; } = string.Empty;

    [JsonPropertyName("utm_source")]
    public string? UtmSource { get; init; }

    [JsonPropertyName("utm_medium")]
    public string? UtmMedium { get; init; }

    [JsonPropertyName("utm_campaign")]
    public string? UtmCampaign { get; init; }

    [JsonPropertyName("utm_term")]
    public string? UtmTerm { get; init; }

    [JsonPropertyName("utm_content")]
    public string? UtmContent { get; init; }

    [JsonPropertyName("ad_id")]
    public string? AdId { get; init; }

    [JsonPropertyName("fbclid")]
    public string? FbClid { get; init; }

    [JsonPropertyName("gclid")]
    public string? GClid { get; init; }
}

public sealed record CreativePerformanceDto
{
    [JsonPropertyName("ad_id")]
    public string AdId { get; init; } = string.Empty;

    [JsonPropertyName("campaign")]
    public string Campaign { get; init; } = string.Empty;

    [JsonPropertyName("source")]
    public string Source { get; init; } = string.Empty;

    [JsonPropertyName("orders_count")]
    public int OrdersCount { get; init; }

    [JsonPropertyName("total_revenue_brl")]
    public decimal TotalRevenueBrl { get; init; }

    [JsonPropertyName("average_ticket_brl")]
    public decimal AverageTicketBrl { get; init; }
}

public sealed record SourcePerformanceDto
{
    [JsonPropertyName("source")]
    public string Source { get; init; } = string.Empty;

    [JsonPropertyName("visits_count")]
    public int VisitsCount { get; init; }

    [JsonPropertyName("orders_count")]
    public int OrdersCount { get; init; }

    [JsonPropertyName("conversion_rate")]
    public decimal ConversionRate { get; init; }

    [JsonPropertyName("revenue_brl")]
    public decimal RevenueBrl { get; init; }
}

public sealed record TenantTrafficOverviewDto
{
    [JsonPropertyName("total_attributed_revenue_brl")]
    public decimal TotalAttributedRevenueBrl { get; init; }

    [JsonPropertyName("total_tracked_orders")]
    public int TotalTrackedOrders { get; init; }

    [JsonPropertyName("total_visits")]
    public int TotalVisits { get; init; }

    [JsonPropertyName("average_ticket_brl")]
    public decimal AverageTicketBrl { get; init; }

    [JsonPropertyName("top_source")]
    public string TopSource { get; init; } = "Direto / Orgânico";

    [JsonPropertyName("period_days")]
    public int PeriodDays { get; init; }

    [JsonPropertyName("sources")]
    public List<SourcePerformanceDto> Sources { get; init; } = new();

    [JsonPropertyName("creatives")]
    public List<CreativePerformanceDto> Creatives { get; init; } = new();
}

public sealed record VerifyTagRequestDto
{
    [JsonPropertyName("store_url")]
    public string StoreUrl { get; init; } = string.Empty;
}

public sealed record VerifyTagResponseDto
{
    [JsonPropertyName("is_installed")]
    public bool IsInstalled { get; init; }

    [JsonPropertyName("store_url")]
    public string StoreUrl { get; init; } = string.Empty;

    [JsonPropertyName("checked_at")]
    public DateTimeOffset CheckedAt { get; init; }

    [JsonPropertyName("message")]
    public string Message { get; init; } = string.Empty;
}
