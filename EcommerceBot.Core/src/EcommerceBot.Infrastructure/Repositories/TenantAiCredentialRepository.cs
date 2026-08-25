using System;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public class TenantAiCredentialRepository : ITenantAiCredentialRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public TenantAiCredentialRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<TenantAiCredential?> GetByProviderAsync(Guid tenantId, string provider)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = """
            SELECT * FROM dbo.TenantAiCredentials 
            WHERE TenantId = @TenantId AND Provider = @Provider AND IsActive = 1
        """;
        return await connection.QueryFirstOrDefaultAsync<TenantAiCredential>(sql, new { TenantId = tenantId, Provider = provider });
    }

    public async Task UpsertAsync(TenantAiCredential credential)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
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

        await connection.ExecuteAsync(sql, credential);
    }
}
