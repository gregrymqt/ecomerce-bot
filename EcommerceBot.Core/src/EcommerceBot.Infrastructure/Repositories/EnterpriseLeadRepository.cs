using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Data;

namespace EcommerceBot.Infrastructure.Repositories
{
    public class EnterpriseLeadRepository : IEnterpriseLeadRepository
    {
        private readonly IDbConnectionFactory _connectionFactory;

        public EnterpriseLeadRepository(IDbConnectionFactory connectionFactory)
        {
            _connectionFactory = connectionFactory;
        }

        public async Task<EnterpriseLead?> GetByIdAsync(Guid id)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = "SELECT * FROM dbo.EnterpriseLeads WHERE Id = @Id";
            return await connection.QueryFirstOrDefaultAsync<EnterpriseLead>(sql, new { Id = id });
        }

        public async Task<EnterpriseLead?> GetByEmailAsync(string email)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = "SELECT * FROM dbo.EnterpriseLeads WHERE Email = @Email";
            return await connection.QueryFirstOrDefaultAsync<EnterpriseLead>(sql, new { Email = email.ToLowerInvariant() });
        }

        public async Task<EnterpriseLead> CreateAsync(EnterpriseLead lead)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = @"
                INSERT INTO dbo.EnterpriseLeads (
                    Id, Email, CompanyName, JobTitle, ExpectedVolume, 
                    Phone, TeamSize, Notes, Status, InternalNotes, 
                    IpAddress, CreatedAt, UpdatedAt
                )
                OUTPUT INSERTED.*
                VALUES (
                    @Id, @Email, @CompanyName, @JobTitle, @ExpectedVolume, 
                    @Phone, @TeamSize, @Notes, @Status, @InternalNotes, 
                    @IpAddress, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET()
                );
            ";
            
            if (lead.Id == Guid.Empty) lead.Id = Guid.NewGuid();
            if (string.IsNullOrEmpty(lead.Status)) lead.Status = "PENDING";
            
            return await connection.QuerySingleAsync<EnterpriseLead>(sql, lead);
        }

        public async Task<(List<EnterpriseLead> Leads, int TotalCount)> GetAllAsync(string? status, string? search, int page, int pageSize)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();

            var whereClauses = new List<string>();
            var parameters = new DynamicParameters();

            if (!string.IsNullOrWhiteSpace(status) && !status.Equals("ALL", StringComparison.OrdinalIgnoreCase))
            {
                whereClauses.Add("Status = @Status");
                parameters.Add("Status", status.ToUpperInvariant());
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                whereClauses.Add("(Email LIKE @Search OR CompanyName LIKE @Search OR Phone LIKE @Search OR Notes LIKE @Search)");
                parameters.Add("Search", $"%{search}%");
            }

            var whereSql = whereClauses.Count > 0 ? "WHERE " + string.Join(" AND ", whereClauses) : "";

            var offset = (Math.Max(1, page) - 1) * pageSize;
            parameters.Add("Offset", offset);
            parameters.Add("PageSize", pageSize);

            var countSql = $"SELECT COUNT(1) FROM dbo.EnterpriseLeads {whereSql}";
            var totalCount = await connection.ExecuteScalarAsync<int>(countSql, parameters);

            var listSql = $@"
                SELECT * FROM dbo.EnterpriseLeads
                {whereSql}
                ORDER BY CreatedAt DESC
                OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
            ";

            var leads = (await connection.QueryAsync<EnterpriseLead>(listSql, parameters)).ToList();
            return (leads, totalCount);
        }

        public async Task<Dictionary<string, int>> GetMetricsAsync()
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = @"
                SELECT 
                    ISNULL(Status, 'PENDING') AS StatusKey, 
                    COUNT(1) AS CountVal
                FROM dbo.EnterpriseLeads
                GROUP BY Status;
            ";

            var results = await connection.QueryAsync<(string StatusKey, int CountVal)>(sql);
            var metrics = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

            int total = 0;
            foreach (var row in results)
            {
                metrics[row.StatusKey] = row.CountVal;
                total += row.CountVal;
            }
            metrics["TOTAL"] = total;

            return metrics;
        }

        public async Task<bool> UpdateStatusAsync(Guid id, string status, string? internalNotes)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = @"
                UPDATE dbo.EnterpriseLeads
                SET Status = @Status,
                    InternalNotes = CASE WHEN @InternalNotes IS NOT NULL THEN @InternalNotes ELSE InternalNotes END,
                    UpdatedAt = SYSDATETIMEOFFSET()
                WHERE Id = @Id;
            ";

            var rows = await connection.ExecuteAsync(sql, new { Id = id, Status = status.ToUpperInvariant(), InternalNotes = internalNotes });
            return rows > 0;
        }

        public async Task<bool> MarkConvertedAsync(Guid id, Guid tenantId, Guid userId, string? internalNotes)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = @"
                UPDATE dbo.EnterpriseLeads
                SET Status = 'CONVERTED',
                    ConvertedTenantId = @TenantId,
                    ConvertedUserId = @UserId,
                    InternalNotes = CASE WHEN @InternalNotes IS NOT NULL THEN @InternalNotes ELSE InternalNotes END,
                    UpdatedAt = SYSDATETIMEOFFSET()
                WHERE Id = @Id;
            ";

            var rows = await connection.ExecuteAsync(sql, new { Id = id, TenantId = tenantId, UserId = userId, InternalNotes = internalNotes });
            return rows > 0;
        }
    }
}
