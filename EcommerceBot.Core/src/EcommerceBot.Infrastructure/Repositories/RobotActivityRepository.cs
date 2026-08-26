using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public class RobotActivityRepository : IRobotActivityRepository
{
    private readonly IDbConnectionFactory _dbConnectionFactory;

    public RobotActivityRepository(IDbConnectionFactory dbConnectionFactory)
    {
        _dbConnectionFactory = dbConnectionFactory;
    }

    public async Task<RobotActivity> CreateAsync(RobotActivity activity)
    {
        if (activity.TenantId == Guid.Empty)
        {
            // Se TenantId for vazio, evita violação de FK no SQL Server
            return activity;
        }

        var sql = @"
            INSERT INTO dbo.RobotActivities (TenantId, WorkerType, Status, DetailsJson, DurationMs, CreatedAt)
            OUTPUT INSERTED.Id, INSERTED.CreatedAt
            VALUES (@TenantId, @WorkerType, @Status, @DetailsJson, @DurationMs, SYSDATETIMEOFFSET())";

        using var connection = await _dbConnectionFactory.CreateConnectionAsync();
        var result = await connection.QuerySingleAsync<(Guid Id, DateTimeOffset CreatedAt)>(sql, new
        {
            activity.TenantId,
            activity.WorkerType,
            activity.Status,
            activity.DetailsJson,
            activity.DurationMs
        });

        activity.Id = result.Id;
        activity.CreatedAt = result.CreatedAt;
        return activity;
    }

    public async Task<IEnumerable<RobotActivity>> GetRecentAsync(Guid tenantId, int limit, int offset)
    {
        var sql = @"
            SELECT Id, TenantId, WorkerType, Status, DetailsJson, DurationMs, CreatedAt
            FROM dbo.RobotActivities
            WHERE TenantId = @TenantId
            ORDER BY CreatedAt DESC
            OFFSET @Offset ROWS
            FETCH NEXT @Limit ROWS ONLY";

        using var connection = await _dbConnectionFactory.CreateConnectionAsync();
        return await connection.QueryAsync<RobotActivity>(sql, new { TenantId = tenantId, Limit = limit, Offset = offset });
    }

    public async Task<double> GetAverageLatencyAsync(Guid tenantId, TimeSpan timeframe)
    {
        var cutoff = DateTimeOffset.UtcNow.Subtract(timeframe);
        var sql = @"
            SELECT ISNULL(AVG(CAST(DurationMs AS FLOAT)), 0)
            FROM dbo.RobotActivities
            WHERE TenantId = @TenantId 
              AND CreatedAt >= @Cutoff
              AND DurationMs IS NOT NULL";

        using var connection = await _dbConnectionFactory.CreateConnectionAsync();
        return await connection.QuerySingleAsync<double>(sql, new { TenantId = tenantId, Cutoff = cutoff });
    }
}
