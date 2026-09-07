using System;

namespace EcommerceBot.Application.DTOs.Checkout;

public sealed record CheckoutResponse
{
    public Guid Id { get; init; }
    public string ExternalReference { get; init; } = string.Empty;
    public decimal TotalAmount { get; init; }
    public string Status { get; init; } = string.Empty;
    public string PaymentMethod { get; init; } = string.Empty;
    
    public string? PixQrCode { get; init; }
    public string? PixQrCodeBase64 { get; init; }
    public string? TicketUrl { get; init; }
    
    public DateTimeOffset CreatedAt { get; init; }
}
