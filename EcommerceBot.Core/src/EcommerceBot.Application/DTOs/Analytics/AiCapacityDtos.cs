using System;
using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.Analytics;

public sealed record AiProviderCreditTopupRequest
{
    public string Provider { get; init; } = string.Empty;
    public decimal AmountPaid { get; init; }
    public string Currency { get; init; } = "USD";
    public long TokensCredited { get; init; }
    public string? TransactionReference { get; init; }
    public string Source { get; init; } = "MANUAL_ADMIN";
    public string? Notes { get; init; }
}

public sealed record AiProviderCreditDto
{
    public Guid Id { get; init; }
    public string Provider { get; init; } = string.Empty;
    public decimal AmountPaid { get; init; }
    public string Currency { get; init; } = "USD";
    public long TokensCredited { get; init; }
    public decimal BalanceRemaining { get; init; }
    public string? TransactionReference { get; init; }
    public string Source { get; init; } = string.Empty;
    public string? Notes { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

public sealed record ScenarioDetailDto
{
    public string Label { get; init; } = string.Empty;
    public long Tokens { get; init; }
    public decimal EstimatedCostUsd { get; init; }
    public string Description { get; init; } = string.Empty;
}

public sealed record ProviderCapacityDetailDto
{
    public string Provider { get; init; } = string.Empty;
    public decimal CurrentBalanceUsd { get; init; }
    public long DailyBurnRateTokens { get; init; }
    public decimal DailyBurnRateUsd { get; init; }
    public decimal GrowthRatePercent { get; init; }
    public decimal RunwayDays { get; init; }
    public bool IsCritical { get; init; }
    public decimal RecommendedTopupUsd { get; init; }
    public Dictionary<string, ScenarioDetailDto> Scenarios { get; init; } = new();
}

public sealed record ConsolidatedCapacityDto
{
    public decimal CurrentTotalBalanceUsd { get; init; }
    public long DailyBurnRateTokensTotal { get; init; }
    public decimal DailyBurnRateUsdTotal { get; init; }
    public decimal ConsolidatedRunwayDays { get; init; }
    public bool IsCritical { get; init; }
    public decimal RecommendedTopupUsd { get; init; }
    public Dictionary<string, ScenarioDetailDto> Scenarios { get; init; } = new();
}

public sealed record AiCapacityOverviewResponse
{
    public int ForecastHorizonDays { get; init; } = 30;
    public DateTimeOffset GeneratedAt { get; init; } = DateTimeOffset.UtcNow;
    public ConsolidatedCapacityDto Consolidated { get; init; } = new();
    public Dictionary<string, ProviderCapacityDetailDto> Providers { get; init; } = new();
    public List<AiProviderCreditDto> RecentTopups { get; init; } = new();
}

public sealed record TokenUsageDayDto
{
    public string Date { get; init; } = string.Empty;
    public string Provider { get; init; } = string.Empty;
    public long Tokens { get; init; }
    public decimal CostUsd { get; init; }
}
