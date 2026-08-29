using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Data;

namespace EcommerceBot.Infrastructure.Repositories;

public class RoleRepository : IRoleRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public RoleRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<IEnumerable<Role>> GetAllAsync()
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        var sql = "SELECT Id, Name, Description, IsSystemRole, CreatedAt FROM dbo.Roles ORDER BY Name ASC";
        return await connection.QueryAsync<Role>(sql);
    }

    public async Task<Role?> GetByIdAsync(Guid id)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        var sql = "SELECT Id, Name, Description, IsSystemRole, CreatedAt FROM dbo.Roles WHERE Id = @Id";
        return await connection.QueryFirstOrDefaultAsync<Role>(sql, new { Id = id });
    }

    public async Task<Role?> GetByNameAsync(string name)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        var sql = "SELECT Id, Name, Description, IsSystemRole, CreatedAt FROM dbo.Roles WHERE UPPER(Name) = UPPER(@Name)";
        return await connection.QueryFirstOrDefaultAsync<Role>(sql, new { Name = name });
    }
}
