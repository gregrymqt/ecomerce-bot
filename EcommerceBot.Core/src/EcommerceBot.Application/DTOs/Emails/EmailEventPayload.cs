using System;
using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.Emails;

public sealed record EmailEventPayload
{
    public Guid TenantId { get; init; }
    public string Event { get; init; } = string.Empty;
    public string RecipientEmail { get; init; } = string.Empty;
    public string RecipientName { get; init; } = string.Empty;
    public string? IdempotencyKey { get; init; }
    public Dictionary<string, object> Data { get; init; } = new();
}
