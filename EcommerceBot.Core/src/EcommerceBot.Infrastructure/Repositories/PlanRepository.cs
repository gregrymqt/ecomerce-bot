using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public sealed class PlanRepository : IPlanRepository
{
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly IRedisService _redisService;

    public PlanRepository(IDbConnectionFactory connectionFactory, IRedisService redisService)
    {
        _connectionFactory = connectionFactory;
        _redisService = redisService;
    }

    private static string GetPlanCacheKey(Guid id) => $"plan:{id}";
    private static string GetAllPlansCacheKey(bool onlyActive) => $"plans:all:{onlyActive}";

    public async Task<Plan?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var cacheKey = GetPlanCacheKey(id);

        return await _redisService.GetOrCreateAsync(
            cacheKey,
            async () =>
            {
                using var connection = await _connectionFactory.CreateConnectionAsync();
                const string sql = "SELECT * FROM dbo.Plans WHERE Id = @Id;";
                var cmd = new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken);
                return await connection.QuerySingleOrDefaultAsync<Plan>(cmd);
            },
            TimeSpan.FromHours(1),
            cancellationToken);
    }

    public async Task<IEnumerable<Plan>> GetAllAsync(bool onlyActive = false, CancellationToken cancellationToken = default)
    {
        var cacheKey = GetAllPlansCacheKey(onlyActive);

        var result = await _redisService.GetOrCreateAsync<List<Plan>>(
            cacheKey,
            async () =>
            {
                using var connection = await _connectionFactory.CreateConnectionAsync();
                string sql = "SELECT * FROM dbo.Plans";
                
                if (onlyActive)
                    sql += " WHERE IsActive = 1";
                    
                sql += " ORDER BY Price ASC;";
                
                var cmd = new CommandDefinition(sql, cancellationToken: cancellationToken);
                var plans = await connection.QueryAsync<Plan>(cmd);
                return [.. plans];
            },
            TimeSpan.FromHours(1),
            cancellationToken);

        return result ?? [];
    }

    public async Task<Guid> CreateAsync(Plan plan, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = @"
            INSERT INTO dbo.Plans (
                Name, Description, Price, CreditsIncluded, Badge, IsActive
            )
            OUTPUT INSERTED.Id
            VALUES (
                @Name, @Description, @Price, @CreditsIncluded, @Badge, @IsActive
            );";
            
        var cmd = new CommandDefinition(sql, plan, cancellationToken: cancellationToken);
        var insertedId = await connection.QuerySingleAsync<Guid>(cmd);

        // Invalidação das listagens em cache
        await InvalidateListCacheAsync(cancellationToken);

        return insertedId;
    }

    public async Task UpdateAsync(Plan plan, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = @"
            UPDATE dbo.Plans SET
                Name = @Name,
                Description = @Description,
                Price = @Price,
                CreditsIncluded = @CreditsIncluded,
                Badge = @Badge,
                IsActive = @IsActive,
                UpdatedAt = SYSDATETIMEOFFSET()
            WHERE Id = @Id;";
            
        var cmd = new CommandDefinition(sql, plan, cancellationToken: cancellationToken);
        await connection.ExecuteAsync(cmd);

        // Invalidação da entidade e listagens
        await _redisService.RemoveAsync(GetPlanCacheKey(plan.Id), cancellationToken);
        await InvalidateListCacheAsync(cancellationToken);
    }

    private async Task InvalidateListCacheAsync(CancellationToken cancellationToken)
    {
        await _redisService.RemoveAsync(GetAllPlansCacheKey(true), cancellationToken);
        await _redisService.RemoveAsync(GetAllPlansCacheKey(false), cancellationToken);
    }
}
