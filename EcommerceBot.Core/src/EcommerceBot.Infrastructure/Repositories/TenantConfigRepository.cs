using System;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public sealed class TenantConfigRepository : ITenantConfigRepository
{
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly IRedisService _redisService;

    public TenantConfigRepository(IDbConnectionFactory connectionFactory, IRedisService redisService)
    {
        _connectionFactory = connectionFactory;
        _redisService = redisService;
    }

    private static string GetConfigCacheKey(Guid tenantId) => $"tenant:config:{tenantId}";

    public async Task<TenantConfig?> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var cacheKey = GetConfigCacheKey(tenantId);

        return await _redisService.GetOrCreateAsync(
            cacheKey,
            async () =>
            {
                using var connection = await _connectionFactory.CreateConnectionAsync();
                
                const string sql = """
                    SELECT * FROM dbo.TenantConfigs 
                    WHERE TenantId = @TenantId
                """;

                var cmd = new CommandDefinition(sql, new { TenantId = tenantId }, cancellationToken: cancellationToken);
                return await connection.QueryFirstOrDefaultAsync<TenantConfig>(cmd);
            },
            TimeSpan.FromMinutes(30),
            cancellationToken);
    }

    public async Task UpsertAsync(TenantConfig config, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        
        const string sql = """
            IF EXISTS (SELECT 1 FROM dbo.TenantConfigs WHERE TenantId = @TenantId)
            BEGIN
                UPDATE dbo.TenantConfigs
                SET AiSettingsJson = @AiSettingsJson,
                    PricingSettingsJson = @PricingSettingsJson,
                    StoreProfileJson = @StoreProfileJson,
                    UpdatedAt = SYSDATETIMEOFFSET()
                WHERE TenantId = @TenantId
            END
            ELSE
            BEGIN
                INSERT INTO dbo.TenantConfigs (Id, TenantId, AiSettingsJson, PricingSettingsJson, StoreProfileJson, CreatedAt, UpdatedAt)
                VALUES (NEWID(), @TenantId, @AiSettingsJson, @PricingSettingsJson, @StoreProfileJson, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET())
            END
        """;

        var cmd = new CommandDefinition(sql, config, cancellationToken: cancellationToken);
        await connection.ExecuteAsync(cmd);

        // Invalida cache de configuração do tenant
        await _redisService.RemoveAsync(GetConfigCacheKey(config.TenantId), cancellationToken);
    }
}
