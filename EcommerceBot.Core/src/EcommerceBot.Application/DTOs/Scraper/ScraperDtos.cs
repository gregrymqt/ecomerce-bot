using System;

namespace EcommerceBot.Application.DTOs.Scraper;

public sealed record WebScraperRequest
{
    public string Url { get; init; } = string.Empty;
}

[Obsolete("Utilize ScrapingRequestMessage do namespace EcommerceBot.Application.DTOs.Messaging")]
public sealed record ImportRequestMessage
{
    public string ProductId { get; init; } = string.Empty;
    public string TenantId { get; init; } = string.Empty;
    public string TargetUrl { get; init; } = string.Empty;
}
