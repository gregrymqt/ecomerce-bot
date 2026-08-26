using System;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public class TenantConfigRepository : ITenantConfigRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public TenantConfigRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<TenantConfig?> GetByTenantIdAsync(Guid tenantId)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        
        const string sql = """
            SELECT * FROM dbo.TenantConfigs 
            WHERE TenantId = @TenantId
        """;

        return await connection.QueryFirstOrDefaultAsync<TenantConfig>(sql, new { TenantId = tenantId });
    }

    public async Task UpsertAsync(TenantConfig config)
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

        await connection.ExecuteAsync(sql, config);
    }
}
