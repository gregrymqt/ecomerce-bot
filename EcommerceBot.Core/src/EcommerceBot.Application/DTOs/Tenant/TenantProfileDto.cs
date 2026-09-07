using System;

namespace EcommerceBot.Application.DTOs.Tenant;

public sealed record TenantProfileDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Slug { get; init; } = string.Empty;
    public string PlanTier { get; init; } = "FREE";
    public int CreditsBalance { get; init; }
    public bool IsActive { get; init; } = true;
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
