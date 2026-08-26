using System;
using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.System;

public class DashboardTelemetryResponse
{
    public ProductStatusSummary ProductStatus { get; set; } = new();
    public List<TokenTelemetrySchema> TokenUsage { get; set; } = new();
    public double AverageLatencyMs { get; set; }
    public double HoursSaved { get; set; }
}

public class ProductStatusSummary
{
    public int Raw { get; set; }
    public int Processing { get; set; }
    public int Processed { get; set; }
    public int Failed { get; set; }
}

public class TokenTelemetrySchema
{
    public string Provider { get; set; } = string.Empty;
    public int TotalPromptTokens { get; set; }
    public int TotalCompletionTokens { get; set; }
    public int TotalTokens { get; set; }
}

public class RobotActivityDto
{
    public Guid Id { get; set; }
    public string WorkerType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? DetailsJson { get; set; }
    public int? DurationMs { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class SystemHealthResponse
{
    public string Status { get; set; } = string.Empty;
    public Dictionary<string, string> Services { get; set; } = new();
}

public class DemoRequest
{
    public List<string> Urls { get; set; } = new();
}
