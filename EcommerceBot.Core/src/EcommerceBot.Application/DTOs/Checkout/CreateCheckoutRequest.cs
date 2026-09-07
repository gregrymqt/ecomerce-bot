using System;
using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.Checkout;

public sealed record CreateCheckoutRequest
{
    public string ExternalReference { get; init; } = string.Empty;
    public string PaymentMethod { get; init; } = string.Empty; // "pix", "credit_card", "ticket"
    
    public string PayerEmail { get; init; } = string.Empty;
    public string? PayerDocumentType { get; init; } // "CPF", "CNPJ"
    public string? PayerDocumentNumber { get; init; }

    public List<CheckoutItemDto> Items { get; init; } = new();
}

public sealed record CheckoutItemDto
{
    public string Title { get; init; } = string.Empty;
    public decimal UnitPrice { get; init; }
    public int Quantity { get; init; } = 1;
    public string? ExternalCode { get; init; }
}
