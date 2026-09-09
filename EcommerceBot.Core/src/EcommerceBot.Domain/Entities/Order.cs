using System;
using System.Collections.Generic;

namespace EcommerceBot.Domain.Entities;

/// <summary>
/// Pedido transacional de assinatura ou recarga de créditos (dbo.Orders).
/// </summary>
public sealed class Order
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid? UserId { get; set; }
    public Guid? PlanId { get; set; }
    
    public string? ExternalReference { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal TotalPaidAmount { get; set; }
    public string Currency { get; set; } = "BRL";
    public string Status { get; set; } = "pending";
    public string PaymentMethod { get; set; } = string.Empty;
    
    public string? MpPaymentId { get; set; }
    public string? PixQrCode { get; set; }
    public string? PixQrCodeBase64 { get; set; }
    public DateTimeOffset? PixExpirationDate { get; set; }
    
    public string? CardLastFourDigits { get; set; }
    public string? CardBrand { get; set; }
    public int Installments { get; set; } = 1;
    
    public string? PayerName { get; set; }
    public string? PayerEmail { get; set; }
    public string? PayerDocumentType { get; set; }
    public string? PayerDocumentNumber { get; set; }
    public string? PayerZipCode { get; set; }
    public string? PayerStreetName { get; set; }
    public string? PayerStreetNumber { get; set; }
    public string? PayerComplement { get; set; }
    public string? PayerNeighborhood { get; set; }
    public string? PayerCity { get; set; }
    public string? PayerFederalUnit { get; set; }
    public string? TicketUrl { get; set; }
    
    public DateTimeOffset? PaidAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public List<OrderItem> Items { get; set; } = [];
}
