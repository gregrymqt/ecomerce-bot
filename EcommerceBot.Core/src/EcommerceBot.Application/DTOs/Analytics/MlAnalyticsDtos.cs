using System;
using System.Collections.Generic;
using System.Text.Json;

namespace EcommerceBot.Application.DTOs.Analytics;

public class MlTriggerRequest
{
    public string JobType { get; set; } = "FULL_ANALYTICS";
}

public class MlInsightsResponse
{
    public Guid TenantId { get; set; }
    public string JobType { get; set; } = "FULL_ANALYTICS";
    public string Status { get; set; } = "SUCCESS";
    public DateTimeOffset LastAnalyzedAt { get; set; }
    public JsonElement? Rfm { get; set; }
    public JsonElement? Churn { get; set; }
    public JsonElement? Ltv { get; set; }
    public string? ErrorMessage { get; set; }
}
