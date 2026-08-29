using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Data;

namespace EcommerceBot.Infrastructure.Repositories;

public class TenantSsoMappingRepository : ITenantSsoMappingRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public TenantSsoMappingRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<IEnumerable<TenantSsoMapping>> GetByTenantIdAsync(Guid tenantId)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        var sql = @"
            SELECT m.Id, m.TenantId, m.IdpGroupName, m.RoleId, r.Name AS RoleName, m.IsDefaultRole, m.CreatedAt, m.UpdatedAt
            FROM dbo.TenantSsoMappings m
            INNER JOIN dbo.Roles r ON m.RoleId = r.Id
            WHERE m.TenantId = @TenantId
            ORDER BY m.IsDefaultRole DESC, m.IdpGroupName ASC;
        ";
        return await connection.QueryAsync<TenantSsoMapping>(sql, new { TenantId = tenantId });
    }

    public async Task<TenantSsoMapping?> GetByIdAsync(Guid id, Guid tenantId)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        var sql = @"
            SELECT m.Id, m.TenantId, m.IdpGroupName, m.RoleId, r.Name AS RoleName, m.IsDefaultRole, m.CreatedAt, m.UpdatedAt
            FROM dbo.TenantSsoMappings m
            INNER JOIN dbo.Roles r ON m.RoleId = r.Id
            WHERE m.Id = @Id AND m.TenantId = @TenantId;
        ";
        return await connection.QueryFirstOrDefaultAsync<TenantSsoMapping>(sql, new { Id = id, TenantId = tenantId });
    }

    public async Task<TenantSsoMapping?> GetByGroupAsync(Guid tenantId, string idpGroupName)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        var sql = @"
            SELECT m.Id, m.TenantId, m.IdpGroupName, m.RoleId, r.Name AS RoleName, m.IsDefaultRole, m.CreatedAt, m.UpdatedAt
            FROM dbo.TenantSsoMappings m
            INNER JOIN dbo.Roles r ON m.RoleId = r.Id
            WHERE m.TenantId = @TenantId AND UPPER(m.IdpGroupName) = UPPER(@IdpGroupName);
        ";
        return await connection.QueryFirstOrDefaultAsync<TenantSsoMapping>(sql, new { TenantId = tenantId, IdpGroupName = idpGroupName.Trim() });
    }

    public async Task<TenantSsoMapping?> GetDefaultMappingAsync(Guid tenantId)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        var sql = @"
            SELECT TOP 1 m.Id, m.TenantId, m.IdpGroupName, m.RoleId, r.Name AS RoleName, m.IsDefaultRole, m.CreatedAt, m.UpdatedAt
            FROM dbo.TenantSsoMappings m
            INNER JOIN dbo.Roles r ON m.RoleId = r.Id
            WHERE m.TenantId = @TenantId AND m.IsDefaultRole = 1;
        ";
        return await connection.QueryFirstOrDefaultAsync<TenantSsoMapping>(sql, new { TenantId = tenantId });
    }

    public async Task<TenantSsoMapping> CreateAsync(TenantSsoMapping mapping)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        if (mapping.Id == Guid.Empty) mapping.Id = Guid.NewGuid();

        var sql = @"
            INSERT INTO dbo.TenantSsoMappings (Id, TenantId, IdpGroupName, RoleId, IsDefaultRole, CreatedAt, UpdatedAt)
            OUTPUT INSERTED.Id, INSERTED.TenantId, INSERTED.IdpGroupName, INSERTED.RoleId, INSERTED.IsDefaultRole, INSERTED.CreatedAt, INSERTED.UpdatedAt
            VALUES (@Id, @TenantId, @IdpGroupName, @RoleId, @IsDefaultRole, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());
        ";
        var result = await connection.QuerySingleAsync<TenantSsoMapping>(sql, mapping);
        return result;
    }

    public async Task<bool> UpdateAsync(TenantSsoMapping mapping)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        var sql = @"
            UPDATE dbo.TenantSsoMappings
            SET IdpGroupName = @IdpGroupName,
                RoleId = @RoleId,
                IsDefaultRole = @IsDefaultRole,
                UpdatedAt = SYSDATETIMEOFFSET()
            WHERE Id = @Id AND TenantId = @TenantId;
        ";
        var rows = await connection.ExecuteAsync(sql, mapping);
        return rows > 0;
    }

    public async Task<bool> DeleteAsync(Guid id, Guid tenantId)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        var sql = "DELETE FROM dbo.TenantSsoMappings WHERE Id = @Id AND TenantId = @TenantId";
        var rows = await connection.ExecuteAsync(sql, new { Id = id, TenantId = tenantId });
        return rows > 0;
    }
}
