using System;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public class SubscriptionRepository : ISubscriptionRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public SubscriptionRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<Subscription?> GetByIdAsync(Guid id, Guid tenantId)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = "SELECT * FROM dbo.Subscriptions WHERE Id = @Id AND TenantId = @TenantId";
        return await connection.QueryFirstOrDefaultAsync<Subscription>(sql, new { Id = id, TenantId = tenantId });
    }

    public async Task<Subscription?> GetActiveByTenantIdAsync(Guid tenantId)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = @"
            SELECT TOP 1 * FROM dbo.Subscriptions 
            WHERE TenantId = @TenantId AND Status = 'authorized'
            ORDER BY CurrentPeriodEnd DESC";
        return await connection.QueryFirstOrDefaultAsync<Subscription>(sql, new { TenantId = tenantId });
    }

    public async Task<Subscription?> GetByMpPreapprovalIdAsync(string mpPreapprovalId)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = "SELECT TOP 1 * FROM dbo.Subscriptions WHERE MpPreapprovalId = @MpPreapprovalId";
        return await connection.QueryFirstOrDefaultAsync<Subscription>(sql, new { MpPreapprovalId = mpPreapprovalId });
    }

    public async Task<Subscription> CreateAsync(Subscription subscription)
    {
        if (subscription.Id == Guid.Empty) subscription.Id = Guid.NewGuid();
        if (subscription.CreatedAt == default) subscription.CreatedAt = DateTimeOffset.UtcNow;
        if (subscription.UpdatedAt == default) subscription.UpdatedAt = DateTimeOffset.UtcNow;

        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = @"
            INSERT INTO dbo.Subscriptions 
            (Id, TenantId, PlanId, MpPreapprovalId, MpPayerId, Status, 
             CurrentPeriodStart, CurrentPeriodEnd, CancelledAt, CreatedAt, UpdatedAt)
            VALUES 
            (@Id, @TenantId, @PlanId, @MpPreapprovalId, @MpPayerId, @Status, 
             @CurrentPeriodStart, @CurrentPeriodEnd, @CancelledAt, @CreatedAt, @UpdatedAt)";

        await connection.ExecuteAsync(sql, subscription);
        return subscription;
    }

    public async Task UpdateAsync(Subscription subscription)
    {
        subscription.UpdatedAt = DateTimeOffset.UtcNow;
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = @"
            UPDATE dbo.Subscriptions
            SET PlanId = @PlanId,
                MpPreapprovalId = @MpPreapprovalId,
                MpPayerId = @MpPayerId,
                Status = @Status,
                CurrentPeriodStart = @CurrentPeriodStart,
                CurrentPeriodEnd = @CurrentPeriodEnd,
                CancelledAt = @CancelledAt,
                UpdatedAt = @UpdatedAt
            WHERE Id = @Id AND TenantId = @TenantId";

        await connection.ExecuteAsync(sql, subscription);
    }
}
