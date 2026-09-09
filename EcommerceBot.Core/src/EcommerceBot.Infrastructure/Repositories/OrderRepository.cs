using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public sealed class OrderRepository : IOrderRepository
{
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly IRedisService _redisService;
    private static readonly TimeSpan OrderCacheTtl = TimeSpan.FromMinutes(3);

    public OrderRepository(IDbConnectionFactory connectionFactory, IRedisService redisService)
    {
        _connectionFactory = connectionFactory ?? throw new ArgumentNullException(nameof(connectionFactory));
        _redisService = redisService ?? throw new ArgumentNullException(nameof(redisService));
    }

    private static string GetOrderCacheKey(Guid tenantId, Guid id) => $"order:tenant:{tenantId}:id:{id}";
    private static string GetOrderRefCacheKey(Guid tenantId, string externalReference) => $"order:tenant:{tenantId}:ref:{externalReference}";

    public async Task<Order> CreateOrderAsync(Order order, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        if (order.Id == Guid.Empty) order.Id = Guid.NewGuid();
        if (order.CreatedAt == default) order.CreatedAt = DateTimeOffset.UtcNow;
        if (order.UpdatedAt == default) order.UpdatedAt = DateTimeOffset.UtcNow;

        const string sqlOrder = @"
            INSERT INTO dbo.Orders 
            (Id, TenantId, UserId, PlanId, ExternalReference, TotalAmount, TotalPaidAmount, Currency, Status, PaymentMethod, 
             MpPaymentId, PixQrCode, PixQrCodeBase64, PixExpirationDate, PayerEmail, PayerDocumentType, 
             PayerDocumentNumber, TicketUrl, CreatedAt, UpdatedAt)
            VALUES 
            (@Id, @TenantId, @UserId, @PlanId, @ExternalReference, @TotalAmount, @TotalPaidAmount, @Currency, @Status, @PaymentMethod, 
             @MpPaymentId, @PixQrCode, @PixQrCodeBase64, @PixExpirationDate, @PayerEmail, @PayerDocumentType, 
             @PayerDocumentNumber, @TicketUrl, @CreatedAt, @UpdatedAt);";

        var cmdOrder = new CommandDefinition(sqlOrder, order, cancellationToken: cancellationToken);
        await connection.ExecuteAsync(cmdOrder);

        if (order.Items.Count > 0)
        {
            const string sqlItems = @"
                INSERT INTO dbo.OrderItems (OrderId, Title, UnitPrice, Quantity, ExternalCode)
                VALUES (@OrderId, @Title, @UnitPrice, @Quantity, @ExternalCode);";

            foreach (var item in order.Items)
            {
                item.OrderId = order.Id;
            }

            var cmdItems = new CommandDefinition(sqlItems, order.Items, cancellationToken: cancellationToken);
            await connection.ExecuteAsync(cmdItems);
        }

        await InvalidateOrderCacheAsync(order.TenantId, order.Id, order.ExternalReference, cancellationToken);

        return order;
    }

    public async Task<Order?> GetOrderByIdAsync(Guid id, Guid tenantId, CancellationToken cancellationToken = default)
    {
        var cacheKey = GetOrderCacheKey(tenantId, id);

        return await _redisService.GetOrCreateAsync(
            cacheKey,
            async () =>
            {
                using var connection = await _connectionFactory.CreateConnectionAsync();
                const string sql = "SELECT * FROM dbo.Orders WHERE Id = @Id AND TenantId = @TenantId;";
                var cmd = new CommandDefinition(sql, new { Id = id, TenantId = tenantId }, cancellationToken: cancellationToken);
                var order = await connection.QueryFirstOrDefaultAsync<Order>(cmd);

                if (order != null)
                {
                    const string sqlItems = "SELECT * FROM dbo.OrderItems WHERE OrderId = @OrderId;";
                    var cmdItems = new CommandDefinition(sqlItems, new { OrderId = order.Id }, cancellationToken: cancellationToken);
                    var items = await connection.QueryAsync<OrderItem>(cmdItems);
                    order.Items = items.ToList();
                }

                return order;
            },
            OrderCacheTtl,
            cancellationToken);
    }

    public async Task<Order?> GetOrderByExternalReferenceAsync(string externalReference, Guid tenantId, CancellationToken cancellationToken = default)
    {
        var cacheKey = GetOrderRefCacheKey(tenantId, externalReference);

        return await _redisService.GetOrCreateAsync(
            cacheKey,
            async () =>
            {
                using var connection = await _connectionFactory.CreateConnectionAsync();
                const string sql = "SELECT * FROM dbo.Orders WHERE ExternalReference = @ExternalReference AND TenantId = @TenantId;";
                var cmd = new CommandDefinition(sql, new { ExternalReference = externalReference, TenantId = tenantId }, cancellationToken: cancellationToken);
                var order = await connection.QueryFirstOrDefaultAsync<Order>(cmd);

                if (order != null)
                {
                    const string sqlItems = "SELECT * FROM dbo.OrderItems WHERE OrderId = @OrderId;";
                    var cmdItems = new CommandDefinition(sqlItems, new { OrderId = order.Id }, cancellationToken: cancellationToken);
                    var items = await connection.QueryAsync<OrderItem>(cmdItems);
                    order.Items = items.ToList();
                }

                return order;
            },
            OrderCacheTtl,
            cancellationToken);
    }

    public async Task<Order?> GetOrderByExternalReferenceGlobalAsync(string externalReference, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = "SELECT * FROM dbo.Orders WHERE ExternalReference = @ExternalReference;";
        var cmd = new CommandDefinition(sql, new { ExternalReference = externalReference }, cancellationToken: cancellationToken);
        var order = await connection.QueryFirstOrDefaultAsync<Order>(cmd);

        if (order != null)
        {
            const string sqlItems = "SELECT * FROM dbo.OrderItems WHERE OrderId = @OrderId;";
            var cmdItems = new CommandDefinition(sqlItems, new { OrderId = order.Id }, cancellationToken: cancellationToken);
            var items = await connection.QueryAsync<OrderItem>(cmdItems);
            order.Items = items.ToList();
        }

        return order;
    }

    public async Task<Order?> GetOrderByMpPaymentIdAsync(string mpPaymentId, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = "SELECT * FROM dbo.Orders WHERE MpPaymentId = @MpPaymentId;";
        var cmd = new CommandDefinition(sql, new { MpPaymentId = mpPaymentId }, cancellationToken: cancellationToken);
        var order = await connection.QueryFirstOrDefaultAsync<Order>(cmd);

        if (order != null)
        {
            const string sqlItems = "SELECT * FROM dbo.OrderItems WHERE OrderId = @OrderId;";
            var cmdItems = new CommandDefinition(sqlItems, new { OrderId = order.Id }, cancellationToken: cancellationToken);
            var items = await connection.QueryAsync<OrderItem>(cmdItems);
            order.Items = items.ToList();
        }

        return order;
    }

    public async Task UpdateOrderAsync(Order order, CancellationToken cancellationToken = default)
    {
        order.UpdatedAt = DateTimeOffset.UtcNow;
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = @"
            UPDATE dbo.Orders 
            SET Status = @Status,
                TotalPaidAmount = @TotalPaidAmount,
                MpPaymentId = @MpPaymentId,
                PixQrCode = @PixQrCode,
                PixQrCodeBase64 = @PixQrCodeBase64,
                TicketUrl = @TicketUrl,
                PaidAt = @PaidAt,
                UpdatedAt = @UpdatedAt
            WHERE Id = @Id AND TenantId = @TenantId;";

        var cmd = new CommandDefinition(sql, order, cancellationToken: cancellationToken);
        await connection.ExecuteAsync(cmd);

        await InvalidateOrderCacheAsync(order.TenantId, order.Id, order.ExternalReference, cancellationToken);
    }

    private async Task InvalidateOrderCacheAsync(Guid tenantId, Guid orderId, string? externalReference, CancellationToken cancellationToken)
    {
        await _redisService.RemoveAsync(GetOrderCacheKey(tenantId, orderId), cancellationToken);
        if (!string.IsNullOrWhiteSpace(externalReference))
        {
            await _redisService.RemoveAsync(GetOrderRefCacheKey(tenantId, externalReference), cancellationToken);
        }
    }
}
