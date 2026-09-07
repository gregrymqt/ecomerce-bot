using System;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Integrations;

public sealed record IntegrationSummaryDto
{
    [JsonPropertyName("connected_stores_count")]
    public int ConnectedStoresCount { get; init; }

    [JsonPropertyName("max_stores_allowed")]
    public int MaxStoresAllowed { get; init; }

    [JsonPropertyName("api_status_percentage")]
    public double ApiStatusPercentage { get; init; }

    [JsonPropertyName("last_sync_timestamp")]
    public DateTimeOffset? LastSyncTimestamp { get; init; }
}

public sealed record StoreIntegrationResponseDto
{
    [JsonPropertyName("id")]
    public Guid Id { get; init; }

    [JsonPropertyName("tenant_id")]
    public Guid TenantId { get; init; }

    [JsonPropertyName("platform")]
    public string Platform { get; init; } = string.Empty;

    [JsonPropertyName("store_domain")]
    public string StoreDomain { get; init; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; init; } = "CONNECTED";

    [JsonPropertyName("health_check_status")]
    public string? HealthCheckStatus { get; init; }

    [JsonPropertyName("health_check_latency_ms")]
    public int? HealthCheckLatencyMs { get; init; }

    [JsonPropertyName("created_at")]
    public DateTimeOffset CreatedAt { get; init; }
}

public sealed record HealthCheckResultDto
{
    [JsonPropertyName("success")]
    public bool Success { get; init; }

    [JsonPropertyName("message")]
    public string Message { get; init; } = string.Empty;

    [JsonPropertyName("latency_ms")]
    public int LatencyMs { get; init; }
}
