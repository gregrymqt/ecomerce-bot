namespace EcommerceBot.Domain.Entities;

/// <summary>
/// Item detalhado associado a um pedido transacional (dbo.OrderItems).
/// </summary>
public sealed class OrderItem
{
    public int Id { get; set; }
    public Guid OrderId { get; set; }
    public string Title { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
    public string? ExternalCode { get; set; }
}
