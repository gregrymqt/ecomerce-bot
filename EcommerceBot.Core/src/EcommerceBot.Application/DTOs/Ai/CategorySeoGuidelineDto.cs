using System;

namespace EcommerceBot.Application.DTOs.Ai;

/// <summary>
/// DTO tipado para transporte de diretrizes de SEO por categoria e exemplos few-shot.
/// </summary>
public sealed record CategorySeoGuidelineDto
{
    public Guid Id { get; init; }
    public Guid? TenantId { get; init; }
    public string CategoryPattern { get; init; } = string.Empty;
    public string? MandatoryKeywords { get; init; }
    public string RecommendedTone { get; init; } = string.Empty;
    public string? FewShotExampleTitle { get; init; }
    public string? FewShotExampleDescription { get; init; }
}
