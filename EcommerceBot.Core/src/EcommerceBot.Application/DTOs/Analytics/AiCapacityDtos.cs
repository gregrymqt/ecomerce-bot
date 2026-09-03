using System;
using System.Collections.Generic;
using System.Text.Json;

namespace EcommerceBot.Application.DTOs.Analytics;

public class AiProviderCreditTopupRequest
{
    public string Provider { get; set; } = string.Empty;
    public decimal AmountPaid { get; set; }
    public string Currency { get; set; } = "USD";
    public long TokensCredited { get; set; }
    public string? TransactionReference { get; set; }
    public string Source { get; set; } = "MANUAL_ADMIN";
    public string? Notes { get; set; }
}

public class AiProviderCreditDto
{
    public Guid Id { get; set; }
    public string Provider { get; set; } = string.Empty;
    public decimal AmountPaid { get; set; }
    public string Currency { get; set; } = "USD";
    public long TokensCredited { get; set; }
    public decimal BalanceRemaining { get; set; }
    public string? TransactionReference { get; set; }
    public string Source { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class ScenarioDetailDto
{
    public string Label { get; set; } = string.Empty;
    public long Tokens { get; set; }
    public decimal EstimatedCostUsd { get; set; }
    public string Description { get; set; } = string.Empty;
}

public class ProviderCapacityDetailDto
{
    public string Provider { get; set; } = string.Empty;
    public decimal CurrentBalanceUsd { get; set; }
    public long DailyBurnRateTokens { get; set; }
    public decimal DailyBurnRateUsd { get; set; }
    public decimal GrowthRatePercent { get; set; }
    public decimal RunwayDays { get; set; }
    public bool IsCritical { get; set; }
    public decimal RecommendedTopupUsd { get; set; }
    public Dictionary<string, ScenarioDetailDto> Scenarios { get; set; } = new();
}

public class ConsolidatedCapacityDto
{
    public decimal CurrentTotalBalanceUsd { get; set; }
    public long DailyBurnRateTokensTotal { get; set; }
    public decimal DailyBurnRateUsdTotal { get; set; }
    public decimal ConsolidatedRunwayDays { get; set; }
    public bool IsCritical { get; set; }
    public decimal RecommendedTopupUsd { get; set; }
    public Dictionary<string, ScenarioDetailDto> Scenarios { get; set; } = new();
}

public class AiCapacityOverviewResponse
{
    public int ForecastHorizonDays { get; set; } = 30;
    public DateTimeOffset GeneratedAt { get; set; } = DateTimeOffset.UtcNow;
    public ConsolidatedCapacityDto Consolidated { get; set; } = new();
    public Dictionary<string, ProviderCapacityDetailDto> Providers { get; set; } = new();
    public List<AiProviderCreditDto> RecentTopups { get; set; } = new();
}

public class TokenUsageDayDto
{
    public string Date { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public long Tokens { get; set; }
    public decimal CostUsd { get; set; }
}
