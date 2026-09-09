using System;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

/// <summary>
/// Repositório Dapper para o perfil fiscal e endereço de faturamento do Tenant.
/// Respeita a Regra 1 de isolamento multi-tenant (WHERE TenantId = @TenantId) e SafeCache com Jitter.
/// </summary>
public sealed class TenantBillingProfileRepository : ITenantBillingProfileRepository
{
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly IRedisService _redisService;
    private static readonly TimeSpan ProfileCacheTtl = TimeSpan.FromMinutes(15);

    public TenantBillingProfileRepository(IDbConnectionFactory connectionFactory, IRedisService redisService)
    {
        _connectionFactory = connectionFactory ?? throw new ArgumentNullException(nameof(connectionFactory));
        _redisService = redisService ?? throw new ArgumentNullException(nameof(redisService));
    }

    private static string GetCacheKey(Guid tenantId) => $"tenant:billing_profile:{tenantId}";

    public async Task<TenantBillingProfile?> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var cacheKey = GetCacheKey(tenantId);

        return await _redisService.GetOrCreateAsync(
            cacheKey,
            async () =>
            {
                using var connection = await _connectionFactory.CreateConnectionAsync();

                const string sql = @"
                    SELECT 
                        Id, TenantId, LegalName, TradeName, DocumentType, DocumentNumber, 
                        Email, Phone, ZipCode, StreetName, StreetNumber, Complement, 
                        Neighborhood, City, FederalUnit, CreatedAt, UpdatedAt
                    FROM dbo.TenantBillingProfiles WITH (NOLOCK)
                    WHERE TenantId = @TenantId;";

                var cmd = new CommandDefinition(sql, new { TenantId = tenantId }, cancellationToken: cancellationToken);
                return await connection.QueryFirstOrDefaultAsync<TenantBillingProfile>(cmd);
            },
            ProfileCacheTtl,
            cancellationToken);
    }

    public async Task<TenantBillingProfile> UpsertAsync(TenantBillingProfile profile, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(profile);
        if (profile.TenantId == Guid.Empty) throw new ArgumentException("TenantId é obrigatório.", nameof(profile));

        using var connection = await _connectionFactory.CreateConnectionAsync();

        const string sql = @"
            MERGE dbo.TenantBillingProfiles WITH (HOLDLOCK) AS target
            USING (SELECT @TenantId AS TenantId) AS source
            ON (target.TenantId = source.TenantId)
            WHEN MATCHED THEN
                UPDATE SET
                    LegalName = @LegalName,
                    TradeName = @TradeName,
                    DocumentType = @DocumentType,
                    DocumentNumber = @DocumentNumber,
                    Email = @Email,
                    Phone = @Phone,
                    ZipCode = @ZipCode,
                    StreetName = @StreetName,
                    StreetNumber = @StreetNumber,
                    Complement = @Complement,
                    Neighborhood = @Neighborhood,
                    City = @City,
                    FederalUnit = @FederalUnit,
                    UpdatedAt = SYSDATETIMEOFFSET()
            WHEN NOT MATCHED THEN
                INSERT (Id, TenantId, LegalName, TradeName, DocumentType, DocumentNumber, Email, Phone, ZipCode, StreetName, StreetNumber, Complement, Neighborhood, City, FederalUnit, CreatedAt, UpdatedAt)
                VALUES (NEWSEQUENTIALID(), @TenantId, @LegalName, @TradeName, @DocumentType, @DocumentNumber, @Email, @Phone, @ZipCode, @StreetName, @StreetNumber, @Complement, @Neighborhood, @City, @FederalUnit, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET())
            OUTPUT inserted.Id, inserted.TenantId, inserted.LegalName, inserted.TradeName, inserted.DocumentType, 
                   inserted.DocumentNumber, inserted.Email, inserted.Phone, inserted.ZipCode, inserted.StreetName, 
                   inserted.StreetNumber, inserted.Complement, inserted.Neighborhood, inserted.City, inserted.FederalUnit, 
                   inserted.CreatedAt, inserted.UpdatedAt;";

        var parameters = new
        {
            TenantId = profile.TenantId,
            LegalName = profile.LegalName.Trim(),
            TradeName = string.IsNullOrWhiteSpace(profile.TradeName) ? null : profile.TradeName.Trim(),
            DocumentType = profile.DocumentType.Trim().ToUpperInvariant(),
            DocumentNumber = profile.DocumentNumber.Trim(),
            Email = string.IsNullOrWhiteSpace(profile.Email) ? null : profile.Email.Trim().ToLowerInvariant(),
            Phone = string.IsNullOrWhiteSpace(profile.Phone) ? null : profile.Phone.Trim(),
            ZipCode = profile.ZipCode.Trim(),
            StreetName = profile.StreetName.Trim(),
            StreetNumber = profile.StreetNumber.Trim(),
            Complement = string.IsNullOrWhiteSpace(profile.Complement) ? null : profile.Complement.Trim(),
            Neighborhood = profile.Neighborhood.Trim(),
            City = profile.City.Trim(),
            FederalUnit = profile.FederalUnit.Trim().ToUpperInvariant()
        };

        var cmd = new CommandDefinition(sql, parameters, cancellationToken: cancellationToken);
        var result = await connection.QuerySingleAsync<TenantBillingProfile>(cmd);

        // Invalida o cache Redis do perfil do Tenant
        await _redisService.RemoveAsync(GetCacheKey(profile.TenantId), cancellationToken);

        return result;
    }
}
