using System;
using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.Products;

public class ProductUpdateDto
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public decimal? Price { get; set; }
    public decimal? OriginalPrice { get; set; }
    public int? StockQuantity { get; set; }
    public string? Category { get; set; }
    public string? Brand { get; set; }
    public string? ImagesJson { get; set; }
    public string? Status { get; set; }
}

public class PaginatedProductsResponse
{
    public IEnumerable<ProductResponseDto> Data { get; set; } = new List<ProductResponseDto>();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int Limit { get; set; }
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)Limit);
}

public class ProductResponseDto
{
    public Guid Id { get; set; }
    public string Sku { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public decimal? OriginalPrice { get; set; }
    public int StockQuantity { get; set; }
    public string? Category { get; set; }
    public string? Brand { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ImagesJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
