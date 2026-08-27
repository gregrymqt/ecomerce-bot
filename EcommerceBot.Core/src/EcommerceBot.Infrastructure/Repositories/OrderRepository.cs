using System;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories
{
    public class OrderRepository : IOrderRepository
    {
        private readonly IDbConnectionFactory _connectionFactory;

        public OrderRepository(IDbConnectionFactory connectionFactory)
        {
            _connectionFactory = connectionFactory;
        }

        public async Task<Order> CreateOrderAsync(Order order)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            if (order.Id == Guid.Empty) order.Id = Guid.NewGuid();
            if (order.CreatedAt == default) order.CreatedAt = DateTimeOffset.UtcNow;
            if (order.UpdatedAt == default) order.UpdatedAt = DateTimeOffset.UtcNow;

            var sqlOrder = @"
                INSERT INTO dbo.Orders 
                (Id, TenantId, ExternalReference, TotalAmount, TotalPaidAmount, Currency, Status, PaymentMethod, 
                 MpPaymentId, PixQrCode, PixQrCodeBase64, PixExpirationDate, PayerEmail, PayerDocumentType, 
                 PayerDocumentNumber, TicketUrl, CreatedAt, UpdatedAt)
                VALUES 
                (@Id, @TenantId, @ExternalReference, @TotalAmount, @TotalPaidAmount, @Currency, @Status, @PaymentMethod, 
                 @MpPaymentId, @PixQrCode, @PixQrCodeBase64, @PixExpirationDate, @PayerEmail, @PayerDocumentType, 
                 @PayerDocumentNumber, @TicketUrl, @CreatedAt, @UpdatedAt)";

            await connection.ExecuteAsync(sqlOrder, order);

            if (order.Items.Any())
            {
                var sqlItems = @"
                    INSERT INTO dbo.OrderItems (OrderId, Title, UnitPrice, Quantity, ExternalCode)
                    VALUES (@OrderId, @Title, @UnitPrice, @Quantity, @ExternalCode)";
                
                foreach (var item in order.Items)
                {
                    item.OrderId = order.Id;
                }
                
                await connection.ExecuteAsync(sqlItems, order.Items);
            }

            return order;
        }

        public async Task<Order?> GetOrderByIdAsync(Guid id, Guid tenantId)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = "SELECT * FROM dbo.Orders WHERE Id = @Id AND TenantId = @TenantId";
            var order = await connection.QueryFirstOrDefaultAsync<Order>(sql, new { Id = id, TenantId = tenantId });
            
            if (order != null)
            {
                var sqlItems = "SELECT * FROM dbo.OrderItems WHERE OrderId = @OrderId";
                var items = await connection.QueryAsync<OrderItem>(sqlItems, new { OrderId = order.Id });
                order.Items = items.ToList();
            }
            return order;
        }

        public async Task<Order?> GetOrderByExternalReferenceAsync(string externalReference, Guid tenantId)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = "SELECT * FROM dbo.Orders WHERE ExternalReference = @ExternalReference AND TenantId = @TenantId";
            var order = await connection.QueryFirstOrDefaultAsync<Order>(sql, new { ExternalReference = externalReference, TenantId = tenantId });
            
            if (order != null)
            {
                var sqlItems = "SELECT * FROM dbo.OrderItems WHERE OrderId = @OrderId";
                var items = await connection.QueryAsync<OrderItem>(sqlItems, new { OrderId = order.Id });
                order.Items = items.ToList();
            }
            return order;
        }

        public async Task<Order?> GetOrderByExternalReferenceGlobalAsync(string externalReference)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = "SELECT * FROM dbo.Orders WHERE ExternalReference = @ExternalReference";
            var order = await connection.QueryFirstOrDefaultAsync<Order>(sql, new { ExternalReference = externalReference });
            
            if (order != null)
            {
                var sqlItems = "SELECT * FROM dbo.OrderItems WHERE OrderId = @OrderId";
                var items = await connection.QueryAsync<OrderItem>(sqlItems, new { OrderId = order.Id });
                order.Items = items.ToList();
            }
            return order;
        }

        public async Task<Order?> GetOrderByMpPaymentIdAsync(string mpPaymentId)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = "SELECT * FROM dbo.Orders WHERE MpPaymentId = @MpPaymentId";
            var order = await connection.QueryFirstOrDefaultAsync<Order>(sql, new { MpPaymentId = mpPaymentId });
            
            if (order != null)
            {
                var sqlItems = "SELECT * FROM dbo.OrderItems WHERE OrderId = @OrderId";
                var items = await connection.QueryAsync<OrderItem>(sqlItems, new { OrderId = order.Id });
                order.Items = items.ToList();
            }
            return order;
        }

        public async Task UpdateOrderAsync(Order order)
        {
            order.UpdatedAt = DateTimeOffset.UtcNow;
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = @"
                UPDATE dbo.Orders 
                SET Status = @Status,
                    TotalPaidAmount = @TotalPaidAmount,
                    MpPaymentId = @MpPaymentId,
                    PixQrCode = @PixQrCode,
                    PixQrCodeBase64 = @PixQrCodeBase64,
                    TicketUrl = @TicketUrl,
                    PaidAt = @PaidAt,
                    UpdatedAt = @UpdatedAt
                WHERE Id = @Id AND TenantId = @TenantId";
            
            await connection.ExecuteAsync(sql, order);
        }
    }
}
