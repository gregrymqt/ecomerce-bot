using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public sealed class RobotActivityRepository : IRobotActivityRepository
{
    private readonly IDbConnectionFactory _dbConnectionFactory;

    public RobotActivityRepository(IDbConnectionFactory dbConnectionFactory)
    {
        _dbConnectionFactory = dbConnectionFactory;
    }

    public async Task<RobotActivity> CreateAsync(RobotActivity activity, CancellationToken cancellationToken = default)
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

        using var connection = await _dbConnectionFactory.CreateConnectionAsync(cancellationToken);
        var result = await connection.QuerySingleAsync<(Guid Id, DateTimeOffset CreatedAt)>(new CommandDefinition(sql, new
        {
            activity.TenantId,
            activity.WorkerType,
            activity.Status,
            activity.DetailsJson,
            activity.DurationMs
        }, cancellationToken: cancellationToken));

        activity.Id = result.Id;
        activity.CreatedAt = result.CreatedAt;
        return activity;
    }

    public async Task<IEnumerable<RobotActivity>> GetRecentAsync(Guid tenantId, int limit, int offset, CancellationToken cancellationToken = default)
    {
        var sql = @"
            SELECT Id, TenantId, WorkerType, Status, DetailsJson, DurationMs, CreatedAt
            FROM dbo.RobotActivities
            WHERE TenantId = @TenantId
            ORDER BY CreatedAt DESC
            OFFSET @Offset ROWS
            FETCH NEXT @Limit ROWS ONLY";

        using var connection = await _dbConnectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QueryAsync<RobotActivity>(new CommandDefinition(sql, new { TenantId = tenantId, Limit = limit, Offset = offset }, cancellationToken: cancellationToken));
    }

    public async Task<double> GetAverageLatencyAsync(Guid tenantId, TimeSpan timeframe, CancellationToken cancellationToken = default)
    {
        var cutoff = DateTimeOffset.UtcNow.Subtract(timeframe);
        var sql = @"
            SELECT ISNULL(AVG(CAST(DurationMs AS FLOAT)), 0)
            FROM dbo.RobotActivities
            WHERE TenantId = @TenantId 
              AND CreatedAt >= @Cutoff
              AND DurationMs IS NOT NULL";

        using var connection = await _dbConnectionFactory.CreateConnectionAsync(cancellationToken);
        return await connection.QuerySingleAsync<double>(new CommandDefinition(sql, new { TenantId = tenantId, Cutoff = cutoff }, cancellationToken: cancellationToken));
    }
}
