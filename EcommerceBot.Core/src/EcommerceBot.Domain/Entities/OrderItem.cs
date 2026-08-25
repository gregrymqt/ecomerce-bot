using System;

namespace EcommerceBot.Domain.Entities
{
    public class OrderItem
    {
        public int Id { get; set; }
        public Guid OrderId { get; set; }
        public string Title { get; set; } = string.Empty;
        public decimal UnitPrice { get; set; }
        public int Quantity { get; set; }
        public string? ExternalCode { get; set; }
    }
}
