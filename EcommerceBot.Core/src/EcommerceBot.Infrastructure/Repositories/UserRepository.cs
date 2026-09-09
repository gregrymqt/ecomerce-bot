using System;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public sealed class UserRepository : IUserRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public UserRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = "SELECT * FROM dbo.Users WHERE Id = @Id;";
        var cmd = new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken);
        return await connection.QueryFirstOrDefaultAsync<User>(cmd);
    }

    public async Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = "SELECT * FROM dbo.Users WHERE Email = @Email;";
        var cmd = new CommandDefinition(sql, new { Email = email }, cancellationToken: cancellationToken);
        return await connection.QueryFirstOrDefaultAsync<User>(cmd);
    }

    public async Task<User> CreateAsync(User user, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = @"
            INSERT INTO dbo.Users (Id, TenantId, RoleId, Email, PasswordHash, FullName, Role, IsActive, CreatedAt, UpdatedAt)
            OUTPUT INSERTED.*
            VALUES (
                @Id, 
                @TenantId, 
                COALESCE(@RoleId, (SELECT TOP 1 Id FROM dbo.Roles WHERE Name = @Role), '44444444-4444-4444-4444-444444444444'), 
                @Email, 
                @PasswordHash, 
                @FullName, 
                @Role, 
                @IsActive, 
                SYSDATETIMEOFFSET(), 
                SYSDATETIMEOFFSET()
            );";
        
        if (user.Id == Guid.Empty) user.Id = Guid.NewGuid();
        var cmd = new CommandDefinition(sql, user, cancellationToken: cancellationToken);
        return await connection.QuerySingleAsync<User>(cmd);
    }

    public async Task<bool> UpdateAsync(User user, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = @"
            UPDATE dbo.Users 
            SET Email = @Email,
                PasswordHash = @PasswordHash,
                FullName = @FullName,
                Role = @Role,
                RoleId = COALESCE(@RoleId, (SELECT TOP 1 Id FROM dbo.Roles WHERE Name = @Role), RoleId),
                IsActive = @IsActive,
                UpdatedAt = SYSDATETIMEOFFSET()
            WHERE Id = @Id;";
        var cmd = new CommandDefinition(sql, user, cancellationToken: cancellationToken);
        var rowsAffected = await connection.ExecuteAsync(cmd);
        return rowsAffected > 0;
    }
}
