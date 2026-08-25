using System;
using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.Checkout
{
    public class CreateCheckoutRequest
    {
        public string ExternalReference { get; set; } = string.Empty;
        public string PaymentMethod { get; set; } = string.Empty; // "pix", "credit_card", "ticket"
        
        public string PayerEmail { get; set; } = string.Empty;
        public string? PayerDocumentType { get; set; } // "CPF", "CNPJ"
        public string? PayerDocumentNumber { get; set; }

        public List<CheckoutItemDto> Items { get; set; } = new List<CheckoutItemDto>();
    }

    public class CheckoutItemDto
    {
        public string Title { get; set; } = string.Empty;
        public decimal UnitPrice { get; set; }
        public int Quantity { get; set; } = 1;
        public string? ExternalCode { get; set; }
    }
}
