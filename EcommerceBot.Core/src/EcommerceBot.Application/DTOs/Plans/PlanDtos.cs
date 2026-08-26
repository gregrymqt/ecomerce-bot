using System;

namespace EcommerceBot.Application.DTOs.Plans;

public class CreatePlanRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public int CreditsIncluded { get; set; }
    public string BillingInterval { get; set; } = "MONTHLY";
    public string? MpPreapprovalPlanId { get; set; }
    public int TrialDays { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpdatePlanRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public decimal? Price { get; set; }
    public int? CreditsIncluded { get; set; }
    public string? BillingInterval { get; set; }
    public string? MpPreapprovalPlanId { get; set; }
    public int? TrialDays { get; set; }
    public bool? IsActive { get; set; }
}

public class PlanResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public int CreditsIncluded { get; set; }
    public string BillingInterval { get; set; } = "MONTHLY";
    public string? MpPreapprovalPlanId { get; set; }
    public int TrialDays { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
