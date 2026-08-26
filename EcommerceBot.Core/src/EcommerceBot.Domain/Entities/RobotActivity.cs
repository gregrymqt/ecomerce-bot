using System;

namespace EcommerceBot.Domain.Entities;

public class RobotActivity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string WorkerType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? DetailsJson { get; set; }
    public int? DurationMs { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
