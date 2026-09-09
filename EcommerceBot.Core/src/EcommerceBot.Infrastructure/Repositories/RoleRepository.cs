using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Data;

namespace EcommerceBot.Infrastructure.Repositories;

public sealed class RoleRepository : IRoleRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public RoleRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<IEnumerable<Role>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = "SELECT Id, Name, Description, IsSystemRole, CreatedAt FROM dbo.Roles ORDER BY Name ASC";
        return await connection.QueryAsync<Role>(new CommandDefinition(sql, cancellationToken: cancellationToken));
    }

    public async Task<Role?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = "SELECT Id, Name, Description, IsSystemRole, CreatedAt FROM dbo.Roles WHERE Id = @Id";
        return await connection.QueryFirstOrDefaultAsync<Role>(new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken));
    }

    public async Task<Role?> GetByNameAsync(string name, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = "SELECT Id, Name, Description, IsSystemRole, CreatedAt FROM dbo.Roles WHERE UPPER(Name) = UPPER(@Name)";
        return await connection.QueryFirstOrDefaultAsync<Role>(new CommandDefinition(sql, new { Name = name }, cancellationToken: cancellationToken));
    }
}
