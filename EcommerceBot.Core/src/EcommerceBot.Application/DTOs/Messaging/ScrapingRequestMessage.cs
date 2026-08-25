using System;

namespace EcommerceBot.Application.DTOs.Messaging;

public record ScrapingRequestMessage
{
    public Guid TenantId { get; init; }
    public string Sku { get; init; } = string.Empty;
    public string Url { get; init; } = string.Empty;
    public string PromptContext { get; init; } = string.Empty;
}
