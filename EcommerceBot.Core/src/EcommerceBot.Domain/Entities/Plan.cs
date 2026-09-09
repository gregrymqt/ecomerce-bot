using System;

namespace EcommerceBot.Domain.Entities;

/// <summary>
/// Pacote de créditos perpétuos ou plano de catálogo SaaS (dbo.Plans).
/// </summary>
public sealed class Plan
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public int CreditsIncluded { get; set; }
    public string? Badge { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
