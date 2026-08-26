using System;

namespace EcommerceBot.Application.DTOs.Messaging;

public class PaymentReceivedEvent
{
    public string ResourceId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string RawPayload { get; set; } = string.Empty;
    public DateTimeOffset ReceivedAt { get; set; } = DateTimeOffset.UtcNow;
}
