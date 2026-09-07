using System;

namespace EcommerceBot.Application.DTOs.Messaging;

public sealed record PaymentReceivedEvent
{
    public string ResourceId { get; init; } = string.Empty;
    public string Action { get; init; } = string.Empty;
    public string RawPayload { get; init; } = string.Empty;
    public DateTimeOffset ReceivedAt { get; init; } = DateTimeOffset.UtcNow;
}
