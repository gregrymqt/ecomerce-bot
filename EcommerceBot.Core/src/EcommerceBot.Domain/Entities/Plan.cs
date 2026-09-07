using System;

namespace EcommerceBot.Domain.Entities;

/// <summary>
/// Plano de assinatura do catálogo SaaS com cota de créditos e precificação recorrente (dbo.Plans).
/// </summary>
public sealed class Plan
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public int CreditsIncluded { get; set; }
    public string? Badge { get; set; }
    public string? BillingInterval { get; set; }
    public string? MpPreapprovalPlanId { get; set; }
    public int? TrialDays { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
