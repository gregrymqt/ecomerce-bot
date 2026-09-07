using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public sealed class ProductRepository : IProductRepository
{
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly IRedisService _redisService;

    public ProductRepository(IDbConnectionFactory connectionFactory, IRedisService redisService)
    {
        _connectionFactory = connectionFactory;
        _redisService = redisService;
    }

    private static string GetProductCacheKey(Guid tenantId, string sku) => $"product:{tenantId}:{sku.ToUpperInvariant()}";

    public async Task<Product?> GetBySkuAsync(Guid tenantId, string sku, CancellationToken cancellationToken = default)
    {
        var cacheKey = GetProductCacheKey(tenantId, sku);

        return await _redisService.GetOrCreateAsync(
            cacheKey,
            async () =>
            {
                using var connection = await _connectionFactory.CreateConnectionAsync();
                
                const string sql = """
                    SELECT * FROM dbo.Products 
                    WHERE TenantId = @TenantId AND Sku = @Sku
                """;

                var cmd = new CommandDefinition(sql, new { TenantId = tenantId, Sku = sku }, cancellationToken: cancellationToken);
                return await connection.QueryFirstOrDefaultAsync<Product>(cmd);
            },
            TimeSpan.FromMinutes(15),
            cancellationToken);
    }

    public async Task<IEnumerable<Product>> GetProductsAsync(Guid tenantId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        
        const string sql = """
            SELECT * FROM dbo.Products 
            WHERE TenantId = @TenantId
            ORDER BY CreatedAt DESC
            OFFSET @Offset ROWS
            FETCH NEXT @PageSize ROWS ONLY
        """;

        var offset = (page - 1) * pageSize;
        var cmd = new CommandDefinition(sql, new { TenantId = tenantId, Offset = offset, PageSize = pageSize }, cancellationToken: cancellationToken);
        return await connection.QueryAsync<Product>(cmd);
    }

    public async Task<Guid> AddAsync(Product product, CancellationToken cancellationToken = default)
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

        var cmd = new CommandDefinition(sql, product, cancellationToken: cancellationToken);
        var insertedId = await connection.ExecuteScalarAsync<Guid>(cmd);

        // Invalidação pontual no Redis
        await _redisService.RemoveAsync(GetProductCacheKey(product.TenantId, product.Sku), cancellationToken);

        return insertedId;
    }

    public async Task UpdateStatusAsync(Guid tenantId, string sku, string status, string? metadata = null, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        
        const string sql = """
            UPDATE dbo.Products 
            SET Status = @Status,
                EnrichmentMetadata = COALESCE(@Metadata, EnrichmentMetadata),
                UpdatedAt = SYSDATETIMEOFFSET()
            WHERE TenantId = @TenantId AND Sku = @Sku
        """;

        var cmd = new CommandDefinition(sql, new { TenantId = tenantId, Sku = sku, Status = status, Metadata = metadata }, cancellationToken: cancellationToken);
        await connection.ExecuteAsync(cmd);

        // Invalidação pontual no Redis
        await _redisService.RemoveAsync(GetProductCacheKey(tenantId, sku), cancellationToken);
    }

    public async Task<(IEnumerable<Product> Products, int TotalCount)> GetPaginatedAsync(
        Guid tenantId, string? statusFilter, string? search, int page, int limit, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        
        var offset = (page - 1) * limit;
        
        var sqlWhere = "WHERE TenantId = @TenantId";
        if (!string.IsNullOrEmpty(statusFilter))
            sqlWhere += " AND Status = @StatusFilter";
        if (!string.IsNullOrEmpty(search))
            sqlWhere += " AND (Title LIKE @Search OR Sku LIKE @Search)";

        var countSql = $"SELECT COUNT(1) FROM dbo.Products {sqlWhere}";
        var countCmd = new CommandDefinition(countSql, new { TenantId = tenantId, StatusFilter = statusFilter, Search = $"%{search}%" }, cancellationToken: cancellationToken);
        var totalCount = await connection.ExecuteScalarAsync<int>(countCmd);

        var sql = $@"
            SELECT * FROM dbo.Products 
            {sqlWhere}
            ORDER BY CreatedAt DESC
            OFFSET @Offset ROWS
            FETCH NEXT @Limit ROWS ONLY
        ";

        var cmd = new CommandDefinition(sql, new { 
            TenantId = tenantId, 
            StatusFilter = statusFilter, 
            Search = $"%{search}%", 
            Offset = offset, 
            Limit = limit 
        }, cancellationToken: cancellationToken);

        var products = await connection.QueryAsync<Product>(cmd);

        return (products, totalCount);
    }

    public async Task UpdateAsync(Product product, CancellationToken cancellationToken = default)
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

        var cmd = new CommandDefinition(sql, product, cancellationToken: cancellationToken);
        await connection.ExecuteAsync(cmd);

        // Invalidação de cache após atualização
        await _redisService.RemoveAsync(GetProductCacheKey(product.TenantId, product.Sku), cancellationToken);
    }

    public async Task DeleteAsync(Guid tenantId, string sku, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = "DELETE FROM dbo.Products WHERE TenantId = @TenantId AND Sku = @Sku";
        
        var cmd = new CommandDefinition(sql, new { TenantId = tenantId, Sku = sku }, cancellationToken: cancellationToken);
        await connection.ExecuteAsync(cmd);

        // Invalidação no Redis
        await _redisService.RemoveAsync(GetProductCacheKey(tenantId, sku), cancellationToken);
    }
}
