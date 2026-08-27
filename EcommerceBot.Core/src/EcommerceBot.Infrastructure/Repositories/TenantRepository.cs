using System;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public class TenantRepository : ITenantRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public TenantRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<Tenant?> GetByIdAsync(Guid tenantId)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = "SELECT * FROM dbo.Tenants WHERE Id = @Id AND IsActive = 1";
        return await connection.QueryFirstOrDefaultAsync<Tenant>(sql, new { Id = tenantId });
    }

    public async Task<Tenant?> GetBySlugAsync(string slug)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = "SELECT * FROM dbo.Tenants WHERE Slug = @Slug AND IsActive = 1";
        return await connection.QueryFirstOrDefaultAsync<Tenant>(sql, new { Slug = slug });
    }

    public async Task<bool> HasCreditsAsync(Guid tenantId, int requiredCredits = 1)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = "SELECT CreditsBalance FROM dbo.Tenants WHERE Id = @Id AND IsActive = 1";
        var balance = await connection.ExecuteScalarAsync<int?>(sql, new { Id = tenantId });
        return balance.HasValue && balance.Value >= requiredCredits;
    }

    public async Task DeductCreditsAsync(Guid tenantId, int amount)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = """
            UPDATE dbo.Tenants 
            SET CreditsBalance = CreditsBalance - @Amount,
                UpdatedAt = SYSDATETIMEOFFSET()
            WHERE Id = @Id AND IsActive = 1 AND CreditsBalance >= @Amount
        """;
        await connection.ExecuteAsync(sql, new { Id = tenantId, Amount = amount });
    }

    public async Task AddCreditsAsync(Guid tenantId, int amount)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = """
            UPDATE dbo.Tenants 
            SET CreditsBalance = CreditsBalance + @Amount,
                UpdatedAt = SYSDATETIMEOFFSET()
            WHERE Id = @Id AND IsActive = 1
        """;
        await connection.ExecuteAsync(sql, new { Id = tenantId, Amount = amount });
    }

    public async Task AddManagedBalanceAsync(Guid tenantId, decimal amount)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = """
            UPDATE dbo.Tenants 
            SET ManagedCreditBalance = ManagedCreditBalance + @Amount,
                UpdatedAt = SYSDATETIMEOFFSET()
            WHERE Id = @Id AND IsActive = 1
        """;
        await connection.ExecuteAsync(sql, new { Id = tenantId, Amount = amount });
    }

    public async Task<Tenant> CreateAsync(Tenant tenant)
    {
        if (tenant.Id == Guid.Empty) tenant.Id = Guid.NewGuid();
        if (tenant.CreatedAt == default) tenant.CreatedAt = DateTimeOffset.UtcNow;
        if (tenant.UpdatedAt == default) tenant.UpdatedAt = DateTimeOffset.UtcNow;
        if (string.IsNullOrWhiteSpace(tenant.Slug)) tenant.Slug = tenant.Name.ToLower().Replace(" ", "-") + "-" + Guid.NewGuid().ToString("N")[..6];

        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = """
            INSERT INTO dbo.Tenants (
                Id, Name, Slug, PlanTier, CreditsBalance, ManagedCreditBalance, IsActive,
                FirstUtmSource, FirstUtmMedium, FirstUtmCampaign, FirstAdId, FirstTouchAt,
                CreatedAt, UpdatedAt
            ) VALUES (
                @Id, @Name, @Slug, @PlanTier, @CreditsBalance, @ManagedCreditBalance, @IsActive,
                @FirstUtmSource, @FirstUtmMedium, @FirstUtmCampaign, @FirstAdId, @FirstTouchAt,
                @CreatedAt, @UpdatedAt
            );
        """;
        await connection.ExecuteAsync(sql, tenant);
        return tenant;
    }
}
