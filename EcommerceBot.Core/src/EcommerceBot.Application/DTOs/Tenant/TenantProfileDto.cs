using System;

namespace EcommerceBot.Application.DTOs.Tenant;

public class TenantProfileDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string PlanTier { get; set; } = "FREE";
    public int CreditsBalance { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
