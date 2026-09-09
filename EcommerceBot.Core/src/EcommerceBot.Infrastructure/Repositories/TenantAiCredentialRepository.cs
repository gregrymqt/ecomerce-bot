using System;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public sealed class TenantAiCredentialRepository : ITenantAiCredentialRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public TenantAiCredentialRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<TenantAiCredential?> GetByProviderAsync(Guid tenantId, string provider, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = """
            SELECT * FROM dbo.TenantAiCredentials 
            WHERE TenantId = @TenantId AND Provider = @Provider AND IsActive = 1
        """;
        var cmd = new CommandDefinition(sql, new { TenantId = tenantId, Provider = provider }, cancellationToken: cancellationToken);
        return await connection.QueryFirstOrDefaultAsync<TenantAiCredential>(cmd);
    }

    public async Task<bool> HasActiveByokAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = "SELECT COUNT(1) FROM dbo.TenantAiCredentials WHERE TenantId = @TenantId AND IsActive = 1";
        var cmd = new CommandDefinition(sql, new { TenantId = tenantId }, cancellationToken: cancellationToken);
        var count = await connection.ExecuteScalarAsync<int>(cmd);
        return count > 0;
    }

    public async Task UpsertAsync(TenantAiCredential credential, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = """
            MERGE INTO dbo.TenantAiCredentials AS Target
            USING (SELECT @TenantId AS TenantId, @Provider AS Provider) AS Source
            ON Target.TenantId = Source.TenantId AND Target.Provider = Source.Provider
            WHEN MATCHED THEN
                UPDATE SET 
                    EncryptedApiKey = @EncryptedApiKey,
                    InitializationVector = @InitializationVector,
                    AuthTag = @AuthTag,
                    IsActive = @IsActive,
                    UpdatedAt = SYSDATETIMEOFFSET()
            WHEN NOT MATCHED THEN
                INSERT (Id, TenantId, Provider, EncryptedApiKey, InitializationVector, AuthTag, IsActive, CreatedAt, UpdatedAt)
                VALUES (@Id, @TenantId, @Provider, @EncryptedApiKey, @InitializationVector, @AuthTag, @IsActive, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());
        """;

        if (credential.Id == Guid.Empty)
            credential.Id = Guid.NewGuid();

        var cmd = new CommandDefinition(sql, credential, cancellationToken: cancellationToken);
        await connection.ExecuteAsync(cmd);
    }
}
