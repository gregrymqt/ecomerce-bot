using System;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Data;

namespace EcommerceBot.Infrastructure.Repositories
{
    public class UserRepository : IUserRepository
    {
        private readonly IDbConnectionFactory _connectionFactory;

        public UserRepository(IDbConnectionFactory connectionFactory)
        {
            _connectionFactory = connectionFactory;
        }

        public async Task<User?> GetByIdAsync(Guid id)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = "SELECT * FROM dbo.Users WHERE Id = @Id";
            return await connection.QueryFirstOrDefaultAsync<User>(sql, new { Id = id });
        }

        public async Task<User?> GetByEmailAsync(string email)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = "SELECT * FROM dbo.Users WHERE Email = @Email";
            return await connection.QueryFirstOrDefaultAsync<User>(sql, new { Email = email });
        }

        public async Task<User> CreateAsync(User user)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = @"
                INSERT INTO dbo.Users (Id, TenantId, Email, PasswordHash, FullName, Role, IsActive, CreatedAt, UpdatedAt)
                OUTPUT INSERTED.*
                VALUES (@Id, @TenantId, @Email, @PasswordHash, @FullName, @Role, @IsActive, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());
            ";
            
            if (user.Id == Guid.Empty) user.Id = Guid.NewGuid();
            
            return await connection.QuerySingleAsync<User>(sql, user);
        }

        public async Task<bool> UpdateAsync(User user)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = @"
                UPDATE dbo.Users 
                SET Email = @Email,
                    PasswordHash = @PasswordHash,
                    FullName = @FullName,
                    Role = @Role,
                    IsActive = @IsActive,
                    UpdatedAt = SYSDATETIMEOFFSET()
                WHERE Id = @Id;
            ";
            var rowsAffected = await connection.ExecuteAsync(sql, user);
            return rowsAffected > 0;
        }
    }
}
