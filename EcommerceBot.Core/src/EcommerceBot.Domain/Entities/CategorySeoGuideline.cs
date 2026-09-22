using System;

namespace EcommerceBot.Domain.Entities;

/// <summary>
/// Diretrizes de SEO, tom recomendado e exemplos few-shot por padrão de categoria (dbo.CategorySeoGuidelines).
/// </summary>
public sealed class CategorySeoGuideline
{
    public Guid Id { get; set; }
    public Guid? TenantId { get; set; }
    public string CategoryPattern { get; set; } = string.Empty;
    public string? MandatoryKeywords { get; set; }
    public string RecommendedTone { get; set; } = string.Empty;
    public string? FewShotExampleTitle { get; set; }
    public string? FewShotExampleDescription { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
