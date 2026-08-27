using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public class StoreIntegrationRepository : IStoreIntegrationRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public StoreIntegrationRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<StoreIntegration?> GetByIdAsync(Guid id)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = "SELECT * FROM dbo.StoreIntegrations WHERE Id = @Id";
        return await connection.QueryFirstOrDefaultAsync<StoreIntegration>(sql, new { Id = id });
    }

    public async Task<StoreIntegration?> GetByTenantAndPlatformAsync(Guid tenantId, string platform)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = """
            SELECT * FROM dbo.StoreIntegrations 
            WHERE TenantId = @TenantId AND Platform = @Platform
        """;
        return await connection.QueryFirstOrDefaultAsync<StoreIntegration>(sql, new { TenantId = tenantId, Platform = platform });
    }

    public async Task<StoreIntegration?> GetByDomainAsync(string platform, string storeDomain)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = """
            SELECT * FROM dbo.StoreIntegrations 
            WHERE Platform = @Platform AND StoreDomain = @StoreDomain
        """;
        return await connection.QueryFirstOrDefaultAsync<StoreIntegration>(sql, new { Platform = platform, StoreDomain = storeDomain });
    }

    public async Task<IEnumerable<StoreIntegration>> ListByTenantAsync(Guid tenantId)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = """
            SELECT * FROM dbo.StoreIntegrations 
            WHERE TenantId = @TenantId 
            ORDER BY CreatedAt DESC
        """;
        return await connection.QueryAsync<StoreIntegration>(sql, new { TenantId = tenantId });
    }

    public async Task<int> CountByTenantAsync(Guid tenantId)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = """
            SELECT COUNT(1) FROM dbo.StoreIntegrations 
            WHERE TenantId = @TenantId AND Status = 'CONNECTED'
        """;
        return await connection.ExecuteScalarAsync<int>(sql, new { TenantId = tenantId });
    }

    public async Task UpsertAsync(StoreIntegration integration)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = """
            MERGE INTO dbo.StoreIntegrations AS Target
            USING (SELECT @TenantId AS TenantId, @Platform AS Platform, @StoreDomain AS StoreDomain) AS Source
            ON Target.TenantId = Source.TenantId AND Target.Platform = Source.Platform AND Target.StoreDomain = Source.StoreDomain
            WHEN MATCHED THEN
                UPDATE SET 
                    EncryptedAccessToken = @EncryptedAccessToken,
                    EncryptedClientSecret = @EncryptedClientSecret,
                    InitializationVector = @InitializationVector,
                    AuthTag = @AuthTag,
                    Status = @Status,
                    HealthCheckStatus = @HealthCheckStatus,
                    HealthCheckLatencyMs = @HealthCheckLatencyMs,
                    LastHealthCheckAt = @LastHealthCheckAt,
                    UpdatedAt = SYSDATETIMEOFFSET()
            WHEN NOT MATCHED THEN
                INSERT (Id, TenantId, Platform, StoreDomain, EncryptedAccessToken, EncryptedClientSecret, InitializationVector, AuthTag, Status, HealthCheckStatus, HealthCheckLatencyMs, LastHealthCheckAt, CreatedAt, UpdatedAt)
                VALUES (@Id, @TenantId, @Platform, @StoreDomain, @EncryptedAccessToken, @EncryptedClientSecret, @InitializationVector, @AuthTag, @Status, @HealthCheckStatus, @HealthCheckLatencyMs, @LastHealthCheckAt, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());
        """;

        if (integration.Id == Guid.Empty)
            integration.Id = Guid.NewGuid();

        await connection.ExecuteAsync(sql, integration);
    }

    public async Task<bool> DeleteAsync(Guid tenantId, Guid id)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = "DELETE FROM dbo.StoreIntegrations WHERE TenantId = @TenantId AND Id = @Id";
        var rows = await connection.ExecuteAsync(sql, new { TenantId = tenantId, Id = id });
        return rows > 0;
    }

    public async Task UpdateHealthCheckAsync(Guid id, string status, int latencyMs, string healthMessage)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = """
            UPDATE dbo.StoreIntegrations 
            SET Status = @Status,
                HealthCheckLatencyMs = @LatencyMs,
                HealthCheckStatus = @HealthMessage,
                LastHealthCheckAt = SYSDATETIMEOFFSET(),
                UpdatedAt = SYSDATETIMEOFFSET()
            WHERE Id = @Id
        """;
        await connection.ExecuteAsync(sql, new { Id = id, Status = status, LatencyMs = latencyMs, HealthMessage = healthMessage });
    }
}
