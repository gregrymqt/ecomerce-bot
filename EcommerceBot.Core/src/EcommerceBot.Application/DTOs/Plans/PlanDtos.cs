using System;

namespace EcommerceBot.Application.DTOs.Plans;

public sealed record CreatePlanRequest
{
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public decimal Price { get; init; }
    public int CreditsIncluded { get; init; }
    public string? Badge { get; init; }
    public bool IsActive { get; init; } = true;
}

public sealed record UpdatePlanRequest
{
    public string? Name { get; init; }
    public string? Description { get; init; }
    public decimal? Price { get; init; }
    public int? CreditsIncluded { get; init; }
    public string? Badge { get; init; }
    public bool? IsActive { get; init; }
}

public sealed record PlanResponse
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public decimal Price { get; init; }
    public int CreditsIncluded { get; init; }
    public string? Badge { get; init; }
    public bool IsActive { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
