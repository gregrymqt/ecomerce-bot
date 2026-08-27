using System;

namespace EcommerceBot.Domain.Entities;

public class Tenant
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string PlanTier { get; set; } = "FREE";
    public int CreditsBalance { get; set; } = 0;
    public decimal ManagedCreditBalance { get; set; } = 0.00m;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
