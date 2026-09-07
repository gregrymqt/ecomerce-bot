namespace EcommerceBot.Application.DTOs.Metering;

public sealed record RefundCreditsRequest
{
    public decimal ReservedCost { get; init; }
}
