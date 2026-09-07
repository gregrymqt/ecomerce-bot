using System;

namespace EcommerceBot.Application.DTOs.Scraper;

public sealed record WebScraperRequest
{
    public string Url { get; init; } = string.Empty;
}

public sealed record ImportRequestMessage
{
    public string ProductId { get; init; } = string.Empty;
    public string TenantId { get; init; } = string.Empty;
    public string TargetUrl { get; init; } = string.Empty;
}
