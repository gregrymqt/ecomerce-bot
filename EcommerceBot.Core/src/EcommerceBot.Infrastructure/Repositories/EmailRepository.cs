using System;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Enums;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories
{
    public class EmailRepository : IEmailRepository
    {
        private readonly IDbConnectionFactory _connectionFactory;

        public EmailRepository(IDbConnectionFactory connectionFactory)
        {
            _connectionFactory = connectionFactory;
        }

        public async Task CreateEmailLogAsync(EmailLog log)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            if (log.Id == Guid.Empty) log.Id = Guid.NewGuid();
            if (log.CreatedAt == default) log.CreatedAt = DateTimeOffset.UtcNow;
            if (log.UpdatedAt == default) log.UpdatedAt = DateTimeOffset.UtcNow;

            var sql = @"
                INSERT INTO dbo.EmailLogs 
                (Id, TenantId, ResendId, Recipient, EventType, Status, Subject, IdempotencyKey, ErrorMessage, MetadataInfo, CreatedAt, UpdatedAt)
                VALUES 
                (@Id, @TenantId, @ResendId, @Recipient, @EventType, @Status, @Subject, @IdempotencyKey, @ErrorMessage, @MetadataInfo, @CreatedAt, @UpdatedAt)";

            await connection.ExecuteAsync(sql, log);
        }

        public async Task<EmailLog?> GetEmailLogByResendIdAsync(string resendId)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = "SELECT * FROM dbo.EmailLogs WHERE ResendId = @ResendId";
            return await connection.QueryFirstOrDefaultAsync<EmailLog>(sql, new { ResendId = resendId });
        }

        public async Task UpdateEmailStatusByResendIdAsync(string resendId, EmailStatus status, string? error = null)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = @"
                UPDATE dbo.EmailLogs 
                SET Status = @Status, ErrorMessage = @ErrorMessage, UpdatedAt = SYSDATETIMEOFFSET()
                WHERE ResendId = @ResendId";

            await connection.ExecuteAsync(sql, new { ResendId = resendId, Status = status.ToString(), ErrorMessage = error });
        }
    }
}
