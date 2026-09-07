using System;
using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.Products;

public sealed record ScrapingRequestDto
{
    public string Url { get; init; } = string.Empty;
    public string? Title { get; init; }
    public string? CustomPrompt { get; init; }
}

public sealed record ScrapingResponseDto
{
    public string Message { get; init; } = string.Empty;
    public string Sku { get; init; } = string.Empty;
    public string Status { get; init; } = "PROCESSING";
}

public sealed record ProductUpdateDto
{
    public string? Title { get; init; }
    public string? Description { get; init; }
    public decimal? Price { get; init; }
    public decimal? OriginalPrice { get; init; }
    public int? StockQuantity { get; init; }
    public string? Category { get; init; }
    public string? Brand { get; init; }
    public string? ImagesJson { get; init; }
    public string? Status { get; init; }
}

public sealed record PaginatedProductsResponse
{
    public IEnumerable<ProductResponseDto> Data { get; init; } = new List<ProductResponseDto>();
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int Limit { get; init; }
    public int TotalPages => Limit > 0 ? (int)Math.Ceiling(TotalCount / (double)Limit) : 0;
}

public sealed record ProductResponseDto
{
    public Guid Id { get; init; }
    public string Sku { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public decimal Price { get; init; }
    public decimal? OriginalPrice { get; init; }
    public int StockQuantity { get; init; }
    public string? Category { get; init; }
    public string? Brand { get; init; }
    public string Status { get; init; } = string.Empty;
    public string? ImagesJson { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
