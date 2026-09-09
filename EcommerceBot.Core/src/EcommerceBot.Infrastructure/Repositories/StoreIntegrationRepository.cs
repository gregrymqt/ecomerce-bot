using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public sealed class StoreIntegrationRepository : IStoreIntegrationRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public StoreIntegrationRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<StoreIntegration?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = "SELECT * FROM dbo.StoreIntegrations WHERE Id = @Id";
        var cmd = new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken);
        return await connection.QueryFirstOrDefaultAsync<StoreIntegration>(cmd);
    }

    public async Task<StoreIntegration?> GetByTenantAndPlatformAsync(Guid tenantId, string platform, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = """
            SELECT * FROM dbo.StoreIntegrations 
            WHERE TenantId = @TenantId AND Platform = @Platform
        """;
        var cmd = new CommandDefinition(sql, new { TenantId = tenantId, Platform = platform }, cancellationToken: cancellationToken);
        return await connection.QueryFirstOrDefaultAsync<StoreIntegration>(cmd);
    }

    public async Task<StoreIntegration?> GetByDomainAsync(string platform, string storeDomain, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = """
            SELECT * FROM dbo.StoreIntegrations 
            WHERE Platform = @Platform AND StoreDomain = @StoreDomain
        """;
        var cmd = new CommandDefinition(sql, new { Platform = platform, StoreDomain = storeDomain }, cancellationToken: cancellationToken);
        return await connection.QueryFirstOrDefaultAsync<StoreIntegration>(cmd);
    }

    public async Task<IEnumerable<StoreIntegration>> ListByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = """
            SELECT * FROM dbo.StoreIntegrations 
            WHERE TenantId = @TenantId 
            ORDER BY CreatedAt DESC
        """;
        var cmd = new CommandDefinition(sql, new { TenantId = tenantId }, cancellationToken: cancellationToken);
        return await connection.QueryAsync<StoreIntegration>(cmd);
    }

    public async Task<int> CountByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = """
            SELECT COUNT(1) FROM dbo.StoreIntegrations 
            WHERE TenantId = @TenantId AND Status = 'CONNECTED'
        """;
        var cmd = new CommandDefinition(sql, new { TenantId = tenantId }, cancellationToken: cancellationToken);
        return await connection.ExecuteScalarAsync<int>(cmd);
    }

    public async Task UpsertAsync(StoreIntegration integration, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
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

        var cmd = new CommandDefinition(sql, integration, cancellationToken: cancellationToken);
        await connection.ExecuteAsync(cmd);
    }

    public async Task<bool> DeleteAsync(Guid tenantId, Guid id, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = "DELETE FROM dbo.StoreIntegrations WHERE TenantId = @TenantId AND Id = @Id";
        var cmd = new CommandDefinition(sql, new { TenantId = tenantId, Id = id }, cancellationToken: cancellationToken);
        var rows = await connection.ExecuteAsync(cmd);
        return rows > 0;
    }

    public async Task UpdateHealthCheckAsync(Guid id, string status, int latencyMs, string healthMessage, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = """
            UPDATE dbo.StoreIntegrations 
            SET Status = @Status,
                HealthCheckLatencyMs = @LatencyMs,
                HealthCheckStatus = @HealthMessage,
                LastHealthCheckAt = SYSDATETIMEOFFSET(),
                UpdatedAt = SYSDATETIMEOFFSET()
            WHERE Id = @Id
        """;
        var cmd = new CommandDefinition(sql, new { Id = id, Status = status, LatencyMs = latencyMs, HealthMessage = healthMessage }, cancellationToken: cancellationToken);
        await connection.ExecuteAsync(cmd);
    }

    public async Task UpdateStatusAsync(Guid tenantId, string platform, string status, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = """
            UPDATE dbo.StoreIntegrations 
            SET Status = @Status,
                UpdatedAt = SYSDATETIMEOFFSET()
            WHERE TenantId = @TenantId AND Platform = @Platform;
        """;
        var cmd = new CommandDefinition(sql, new { TenantId = tenantId, Platform = platform, Status = status }, cancellationToken: cancellationToken);
        await connection.ExecuteAsync(cmd);
    }
}
