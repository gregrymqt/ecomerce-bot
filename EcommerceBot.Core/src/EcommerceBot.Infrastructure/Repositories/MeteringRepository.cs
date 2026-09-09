using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public sealed class MeteringRepository : IMeteringRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public MeteringRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<decimal> GetManagedCreditBalanceAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = "SELECT ManagedCreditBalance FROM dbo.Tenants WHERE Id = @TenantId";
        var cmd = new CommandDefinition(sql, new { TenantId = tenantId }, cancellationToken: cancellationToken);
        return await connection.QueryFirstOrDefaultAsync<decimal>(cmd);
    }

    public async Task<LlmUsageLog> CreateUsageLogAsync(LlmUsageLog log, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = @"
            INSERT INTO dbo.LLMUsageLogs 
            (Id, TenantId, ProductId, Provider, ModelUsed, PromptTokens, CompletionTokens, TotalTokens, EstimatedCostUsd, IsByok, ExecutionTimeMs, CreatedAt)
            OUTPUT INSERTED.*
            VALUES 
            (@Id, @TenantId, @ProductId, @Provider, @ModelUsed, @PromptTokens, @CompletionTokens, @TotalTokens, @EstimatedCostUsd, @IsByok, @ExecutionTimeMs, @CreatedAt)";
        
        if (log.Id == Guid.Empty)
            log.Id = Guid.NewGuid();
        if (log.CreatedAt == default)
            log.CreatedAt = DateTimeOffset.UtcNow;

        var cmd = new CommandDefinition(sql, log, cancellationToken: cancellationToken);
        return await connection.QuerySingleAsync<LlmUsageLog>(cmd);
    }

    public async Task<bool> AtomicReserveCreditsAsync(Guid tenantId, decimal estimatedCost, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        // Using UPDLOCK for pessimistic locking in SQL Server
        const string sql = @"
            BEGIN TRAN;
            DECLARE @CurrentBalance DECIMAL(18,6);
            
            SELECT @CurrentBalance = ManagedCreditBalance
            FROM dbo.Tenants WITH (UPDLOCK, READPAST)
            WHERE Id = @TenantId;

            IF @CurrentBalance IS NULL OR @CurrentBalance < @EstimatedCost
            BEGIN
                ROLLBACK TRAN;
                SELECT CAST(0 AS BIT);
            END
            ELSE
            BEGIN
                UPDATE dbo.Tenants 
                SET ManagedCreditBalance = ManagedCreditBalance - @EstimatedCost
                WHERE Id = @TenantId;
                
                COMMIT TRAN;
                SELECT CAST(1 AS BIT);
            END";

        var cmd = new CommandDefinition(sql, new { TenantId = tenantId, EstimatedCost = estimatedCost }, cancellationToken: cancellationToken);
        return await connection.QuerySingleAsync<bool>(cmd);
    }

    public async Task AtomicRefundCreditsAsync(Guid tenantId, decimal amount, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = @"
            UPDATE dbo.Tenants 
            SET ManagedCreditBalance = ManagedCreditBalance + @Amount
            WHERE Id = @TenantId";
        
        var cmd = new CommandDefinition(sql, new { TenantId = tenantId, Amount = amount }, cancellationToken: cancellationToken);
        await connection.ExecuteAsync(cmd);
    }

    public async Task AtomicSettleCreditsAsync(Guid tenantId, decimal reservedCost, decimal actualCost, CancellationToken cancellationToken = default)
    {
        var delta = reservedCost - actualCost;
        if (delta == 0) return;

        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = @"
            UPDATE dbo.Tenants 
            SET ManagedCreditBalance = ManagedCreditBalance + @Delta
            WHERE Id = @TenantId";
        
        var cmd = new CommandDefinition(sql, new { TenantId = tenantId, Delta = delta }, cancellationToken: cancellationToken);
        await connection.ExecuteAsync(cmd);
    }

    public async Task<(int TotalTokens, decimal TotalCost)> GetMonthlyTelemetryAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = @"
            SELECT 
                COALESCE(SUM(TotalTokens), 0) AS TotalTokens,
                COALESCE(SUM(EstimatedCostUsd), 0) AS TotalCost
            FROM dbo.LLMUsageLogs
            WHERE TenantId = @TenantId 
              AND CreatedAt >= DATEADD(month, DATEDIFF(month, 0, GETUTCDATE()), 0)";
        
        var cmd = new CommandDefinition(sql, new { TenantId = tenantId }, cancellationToken: cancellationToken);
        return await connection.QuerySingleAsync<(int, decimal)>(cmd);
    }

    public async Task<(IEnumerable<LlmUsageLog> Items, int TotalCount)> GetUsageLogsPaginatedAsync(Guid tenantId, int page, int limit, DateTimeOffset? startDate, DateTimeOffset? endDate, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        
        const string countSql = @"
            SELECT COUNT(*) FROM dbo.LLMUsageLogs 
            WHERE TenantId = @TenantId 
              AND (@StartDate IS NULL OR CreatedAt >= @StartDate)
              AND (@EndDate IS NULL OR CreatedAt <= @EndDate)";
        
        var countCmd = new CommandDefinition(countSql, new { TenantId = tenantId, StartDate = startDate, EndDate = endDate }, cancellationToken: cancellationToken);
        var totalCount = await connection.ExecuteScalarAsync<int>(countCmd);

        const string sql = @"
            SELECT * FROM dbo.LLMUsageLogs
            WHERE TenantId = @TenantId
              AND (@StartDate IS NULL OR CreatedAt >= @StartDate)
              AND (@EndDate IS NULL OR CreatedAt <= @EndDate)
            ORDER BY CreatedAt DESC
            OFFSET @Offset ROWS
            FETCH NEXT @Limit ROWS ONLY";
        
        var cmd = new CommandDefinition(sql, new 
        { 
            TenantId = tenantId, 
            StartDate = startDate, 
            EndDate = endDate,
            Offset = (page - 1) * limit,
            Limit = limit
        }, cancellationToken: cancellationToken);

        var items = await connection.QueryAsync<LlmUsageLog>(cmd);
        return (items, totalCount);
    }
}
