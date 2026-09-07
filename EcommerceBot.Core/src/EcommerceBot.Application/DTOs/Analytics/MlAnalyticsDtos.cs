using System;
using System.Text.Json;

namespace EcommerceBot.Application.DTOs.Analytics;

public sealed record MlTriggerRequest
{
    public string JobType { get; init; } = "FULL_ANALYTICS";
}

public sealed record MlInsightsResponse
{
    public Guid TenantId { get; init; }
    public string JobType { get; init; } = "FULL_ANALYTICS";
    public string Status { get; init; } = "SUCCESS";
    public DateTimeOffset LastAnalyzedAt { get; init; }
    public JsonElement? Rfm { get; init; }
    public JsonElement? Churn { get; init; }
    public JsonElement? Ltv { get; init; }
    public string? ErrorMessage { get; init; }
}
