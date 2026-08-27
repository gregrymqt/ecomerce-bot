using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public class ProductRepository : IProductRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public ProductRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<Product?> GetBySkuAsync(Guid tenantId, string sku)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        
        const string sql = """
            SELECT * FROM dbo.Products 
            WHERE TenantId = @TenantId AND Sku = @Sku
        """;

        return await connection.QueryFirstOrDefaultAsync<Product>(sql, new { TenantId = tenantId, Sku = sku });
    }

    public async Task<IEnumerable<Product>> GetProductsAsync(Guid tenantId, int page, int pageSize)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        
        // Leveraging the covering index created in 002_Products_And_Catalog.sql
        const string sql = """
            SELECT * FROM dbo.Products 
            WHERE TenantId = @TenantId
            ORDER BY CreatedAt DESC
            OFFSET @Offset ROWS
            FETCH NEXT @PageSize ROWS ONLY
        """;

        var offset = (page - 1) * pageSize;
        return await connection.QueryAsync<Product>(sql, new { TenantId = tenantId, Offset = offset, PageSize = pageSize });
    }

    public async Task<Guid> AddAsync(Product product)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        
        const string sql = """
            INSERT INTO dbo.Products (
                Id, TenantId, Sku, Title, Description, OriginalPrice, Price, 
                Category, Brand, StockQuantity, Status, SourceUrl, ImagesJson, 
                EnrichmentMetadata, ErrorMessage, ShopifyProductId, ShopifyVariantId, ShopifyInventoryItemId,
                NuvemshopProductId, NuvemshopVariantId,
                CreatedAt, UpdatedAt
            )
            OUTPUT INSERTED.Id
            VALUES (
                @Id, @TenantId, @Sku, @Title, @Description, @OriginalPrice, @Price, 
                @Category, @Brand, @StockQuantity, @Status, @SourceUrl, @ImagesJson, 
                @EnrichmentMetadata, @ErrorMessage, @ShopifyProductId, @ShopifyVariantId, @ShopifyInventoryItemId,
                @NuvemshopProductId, @NuvemshopVariantId,
                SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET()
            )
        """;

        if (product.Id == Guid.Empty)
            product.Id = Guid.NewGuid();

        return await connection.ExecuteScalarAsync<Guid>(sql, product);
    }

    public async Task UpdateStatusAsync(Guid tenantId, string sku, string status, string? metadata = null)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        
        const string sql = """
            UPDATE dbo.Products 
            SET Status = @Status,
                EnrichmentMetadata = COALESCE(@Metadata, EnrichmentMetadata),
                UpdatedAt = SYSDATETIMEOFFSET()
            WHERE TenantId = @TenantId AND Sku = @Sku
        """;

        await connection.ExecuteAsync(sql, new { TenantId = tenantId, Sku = sku, Status = status, Metadata = metadata });
    }

    public async Task<(IEnumerable<Product> Products, int TotalCount)> GetPaginatedAsync(
        Guid tenantId, string? statusFilter, string? search, int page, int limit)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        
        var offset = (page - 1) * limit;
        
        var sqlWhere = "WHERE TenantId = @TenantId";
        if (!string.IsNullOrEmpty(statusFilter))
            sqlWhere += " AND Status = @StatusFilter";
        if (!string.IsNullOrEmpty(search))
            sqlWhere += " AND (Title LIKE @Search OR Sku LIKE @Search)";

        var countSql = $"SELECT COUNT(1) FROM dbo.Products {sqlWhere}";
        var totalCount = await connection.ExecuteScalarAsync<int>(countSql, new { TenantId = tenantId, StatusFilter = statusFilter, Search = $"%{search}%" });

        var sql = $@"
            SELECT * FROM dbo.Products 
            {sqlWhere}
            ORDER BY CreatedAt DESC
            OFFSET @Offset ROWS
            FETCH NEXT @Limit ROWS ONLY
        ";

        var products = await connection.QueryAsync<Product>(sql, new { 
            TenantId = tenantId, 
            StatusFilter = statusFilter, 
            Search = $"%{search}%", 
            Offset = offset, 
            Limit = limit 
        });

        return (products, totalCount);
    }

    public async Task UpdateAsync(Product product)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        
        const string sql = """
            UPDATE dbo.Products 
            SET Title = @Title,
                Description = @Description,
                OriginalPrice = @OriginalPrice,
                Price = @Price,
                Category = @Category,
                Brand = @Brand,
                StockQuantity = @StockQuantity,
                Status = @Status,
                ImagesJson = @ImagesJson,
                ShopifyProductId = COALESCE(@ShopifyProductId, ShopifyProductId),
                ShopifyVariantId = COALESCE(@ShopifyVariantId, ShopifyVariantId),
                ShopifyInventoryItemId = COALESCE(@ShopifyInventoryItemId, ShopifyInventoryItemId),
                NuvemshopProductId = COALESCE(@NuvemshopProductId, NuvemshopProductId),
                NuvemshopVariantId = COALESCE(@NuvemshopVariantId, NuvemshopVariantId),
                UpdatedAt = SYSDATETIMEOFFSET()
            WHERE TenantId = @TenantId AND Sku = @Sku
        """;

        await connection.ExecuteAsync(sql, product);
    }

    public async Task DeleteAsync(Guid tenantId, string sku)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = "DELETE FROM dbo.Products WHERE TenantId = @TenantId AND Sku = @Sku";
        await connection.ExecuteAsync(sql, new { TenantId = tenantId, Sku = sku });
    }
}
