using System;
using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.System;

public sealed record DashboardTelemetryResponse
{
    public ProductStatusSummary ProductStatus { get; init; } = new();
    public List<TokenTelemetrySchema> TokenUsage { get; init; } = new();
    public double AverageLatencyMs { get; init; }
    public double HoursSaved { get; init; }
}

public sealed record ProductStatusSummary
{
    public int Raw { get; init; }
    public int Processing { get; init; }
    public int Processed { get; init; }
    public int Failed { get; init; }
}

public sealed record TokenTelemetrySchema
{
    public string Provider { get; init; } = string.Empty;
    public int TotalPromptTokens { get; init; }
    public int TotalCompletionTokens { get; init; }
    public int TotalTokens { get; init; }
}

public sealed record RobotActivityDto
{
    public Guid Id { get; init; }
    public string WorkerType { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string? DetailsJson { get; init; }
    public int? DurationMs { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

public sealed record SystemHealthResponse
{
    public string Status { get; init; } = string.Empty;
    public Dictionary<string, string> Services { get; init; } = new();
}

public sealed record DemoRequest
{
    public List<string> Urls { get; init; } = new();
}
