using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories
{
    public class MeteringRepository : IMeteringRepository
    {
        private readonly IDbConnectionFactory _connectionFactory;

        public MeteringRepository(IDbConnectionFactory connectionFactory)
        {
            _connectionFactory = connectionFactory;
        }

        public async Task<decimal> GetManagedCreditBalanceAsync(Guid tenantId)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = "SELECT ManagedCreditBalance FROM dbo.Tenants WHERE Id = @TenantId";
            return await connection.QueryFirstOrDefaultAsync<decimal>(sql, new { TenantId = tenantId });
        }

        public async Task<LlmUsageLog> CreateUsageLogAsync(LlmUsageLog log)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = @"
                INSERT INTO dbo.LLMUsageLogs 
                (Id, TenantId, ProductId, Provider, ModelUsed, PromptTokens, CompletionTokens, TotalTokens, EstimatedCostUsd, IsByok, ExecutionTimeMs, CreatedAt)
                OUTPUT INSERTED.*
                VALUES 
                (@Id, @TenantId, @ProductId, @Provider, @ModelUsed, @PromptTokens, @CompletionTokens, @TotalTokens, @EstimatedCostUsd, @IsByok, @ExecutionTimeMs, @CreatedAt)";
            
            if (log.Id == Guid.Empty)
                log.Id = Guid.NewGuid();
            if (log.CreatedAt == default)
                log.CreatedAt = DateTimeOffset.UtcNow;

            return await connection.QuerySingleAsync<LlmUsageLog>(sql, log);
        }

        public async Task<bool> AtomicReserveCreditsAsync(Guid tenantId, decimal estimatedCost)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            // Using UPDLOCK for pessimistic locking in SQL Server
            var sql = @"
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

            return await connection.QuerySingleAsync<bool>(sql, new { TenantId = tenantId, EstimatedCost = estimatedCost });
        }

        public async Task AtomicRefundCreditsAsync(Guid tenantId, decimal amount)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = @"
                UPDATE dbo.Tenants 
                SET ManagedCreditBalance = ManagedCreditBalance + @Amount
                WHERE Id = @TenantId";
            
            await connection.ExecuteAsync(sql, new { TenantId = tenantId, Amount = amount });
        }

        public async Task AtomicSettleCreditsAsync(Guid tenantId, decimal reservedCost, decimal actualCost)
        {
            var delta = reservedCost - actualCost;
            if (delta == 0) return;

            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = @"
                UPDATE dbo.Tenants 
                SET ManagedCreditBalance = ManagedCreditBalance + @Delta
                WHERE Id = @TenantId";
            
            await connection.ExecuteAsync(sql, new { TenantId = tenantId, Delta = delta });
        }

        public async Task<(int TotalTokens, decimal TotalCost)> GetMonthlyTelemetryAsync(Guid tenantId)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = @"
                SELECT 
                    COALESCE(SUM(TotalTokens), 0) AS TotalTokens,
                    COALESCE(SUM(EstimatedCostUsd), 0) AS TotalCost
                FROM dbo.LLMUsageLogs
                WHERE TenantId = @TenantId 
                  AND CreatedAt >= DATEADD(month, DATEDIFF(month, 0, GETUTCDATE()), 0)";
            
            return await connection.QuerySingleAsync<(int, decimal)>(sql, new { TenantId = tenantId });
        }

        public async Task<(IEnumerable<LlmUsageLog> Items, int TotalCount)> GetUsageLogsPaginatedAsync(Guid tenantId, int page, int limit, DateTimeOffset? startDate, DateTimeOffset? endDate)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            
            var countSql = @"
                SELECT COUNT(*) FROM dbo.LLMUsageLogs 
                WHERE TenantId = @TenantId 
                  AND (@StartDate IS NULL OR CreatedAt >= @StartDate)
                  AND (@EndDate IS NULL OR CreatedAt <= @EndDate)";
            
            var totalCount = await connection.ExecuteScalarAsync<int>(countSql, new { TenantId = tenantId, StartDate = startDate, EndDate = endDate });

            var sql = @"
                SELECT * FROM dbo.LLMUsageLogs
                WHERE TenantId = @TenantId
                  AND (@StartDate IS NULL OR CreatedAt >= @StartDate)
                  AND (@EndDate IS NULL OR CreatedAt <= @EndDate)
                ORDER BY CreatedAt DESC
                OFFSET @Offset ROWS
                FETCH NEXT @Limit ROWS ONLY";
            
            var items = await connection.QueryAsync<LlmUsageLog>(sql, new 
            { 
                TenantId = tenantId, 
                StartDate = startDate, 
                EndDate = endDate,
                Offset = (page - 1) * limit,
                Limit = limit
            });

            return (items, totalCount);
        }
    }
}
