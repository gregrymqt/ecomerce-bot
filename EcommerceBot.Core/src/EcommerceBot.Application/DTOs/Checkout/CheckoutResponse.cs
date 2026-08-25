using System;
using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.Checkout
{
    public class CheckoutResponse
    {
        public Guid Id { get; set; }
        public string ExternalReference { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public string Status { get; set; } = string.Empty;
        public string PaymentMethod { get; set; } = string.Empty;
        
        public string? PixQrCode { get; set; }
        public string? PixQrCodeBase64 { get; set; }
        public string? TicketUrl { get; set; }
        
        public DateTimeOffset CreatedAt { get; set; }
    }
}
