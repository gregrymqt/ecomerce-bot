using System;

namespace EcommerceBot.Application.DTOs.Messaging;

public sealed record ProductProcessedEvent
{
    public Guid TenantId { get; init; }
    public string Sku { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty; // PROCESSED or FAILED
    public bool IsFallback { get; init; } = false;
    public string ErrorMessage { get; init; } = string.Empty;
    public string AiMetadataJson { get; init; } = string.Empty;
}
