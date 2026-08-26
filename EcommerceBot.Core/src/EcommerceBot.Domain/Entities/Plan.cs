using System;

namespace EcommerceBot.Domain.Entities;

public class Plan
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public int CreditsIncluded { get; set; }
    public string BillingInterval { get; set; } = "MONTHLY"; // MONTHLY, YEARLY
    public string? MpPreapprovalPlanId { get; set; }
    public int TrialDays { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
