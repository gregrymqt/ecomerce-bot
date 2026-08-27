using System;

namespace EcommerceBot.Domain.Entities;

public class Subscription
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid PlanId { get; set; }
    public string? MpPreapprovalId { get; set; }
    public string? MpPayerId { get; set; }
    public string Status { get; set; } = "pending"; // 'authorized', 'pending', 'cancelled', 'paused', 'expired'
    public DateTimeOffset? CurrentPeriodStart { get; set; }
    public DateTimeOffset? CurrentPeriodEnd { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Relacionamento Opcional
    public Plan? Plan { get; set; }
}
