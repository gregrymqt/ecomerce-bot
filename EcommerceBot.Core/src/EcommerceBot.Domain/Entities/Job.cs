using System;

namespace EcommerceBot.Domain.Entities;

public sealed class Job
{
    public Guid Id { get; init; }
    public Guid TenantId { get; init; }
    public string Type { get; init; } = default!;
    public string Payload { get; init; } = "{}";      // JSON raw
    public string Status { get; set; } = "pending";
    public int Attempts { get; set; }
    public DateTimeOffset? LockedUntil { get; set; }
    public DateTimeOffset NextRunAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
