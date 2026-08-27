using System;

namespace EcommerceBot.Domain.Entities;

public class Product
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Sku { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal? OriginalPrice { get; set; }
    public decimal Price { get; set; }
    public string? Category { get; set; }
    public string? Brand { get; set; }
    public int StockQuantity { get; set; }
    public string Status { get; set; } = "RAW"; // RAW, PROCESSING, PROCESSED, FAILED
    public string? SourceUrl { get; set; }
    public string? ImagesJson { get; set; }
    public string? EnrichmentMetadata { get; set; }
    public string? ErrorMessage { get; set; }
    public string? ShopifyProductId { get; set; }
    public string? ShopifyVariantId { get; set; }
    public string? ShopifyInventoryItemId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
