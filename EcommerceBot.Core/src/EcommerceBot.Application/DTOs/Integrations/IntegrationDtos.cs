using System;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Integrations;

public class IntegrationSummaryDto
{
    [JsonPropertyName("connected_stores_count")]
    public int ConnectedStoresCount { get; set; }

    [JsonPropertyName("max_stores_allowed")]
    public int MaxStoresAllowed { get; set; }

    [JsonPropertyName("api_status_percentage")]
    public double ApiStatusPercentage { get; set; }

    [JsonPropertyName("last_sync_timestamp")]
    public DateTimeOffset? LastSyncTimestamp { get; set; }
}

public class StoreIntegrationResponseDto
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("tenant_id")]
    public Guid TenantId { get; set; }

    [JsonPropertyName("platform")]
    public string Platform { get; set; } = string.Empty;

    [JsonPropertyName("store_domain")]
    public string StoreDomain { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; set; } = "CONNECTED";

    [JsonPropertyName("health_check_status")]
    public string? HealthCheckStatus { get; set; }

    [JsonPropertyName("health_check_latency_ms")]
    public int? HealthCheckLatencyMs { get; set; }

    [JsonPropertyName("created_at")]
    public DateTimeOffset CreatedAt { get; set; }
}

public class HealthCheckResultDto
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    [JsonPropertyName("latency_ms")]
    public int LatencyMs { get; set; }
}
