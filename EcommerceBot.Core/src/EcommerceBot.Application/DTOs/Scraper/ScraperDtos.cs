using System;

namespace EcommerceBot.Application.DTOs.Scraper;

public class WebScraperRequest
{
    public string Url { get; set; } = string.Empty;
}

public class ImportRequestMessage
{
    public string ProductId { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
    public string TargetUrl { get; set; } = string.Empty;
}
