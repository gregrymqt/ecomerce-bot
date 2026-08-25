using System;
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

        public async Task<EnterpriseLead?> GetByEmailAsync(string email)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = "SELECT * FROM dbo.EnterpriseLeads WHERE Email = @Email";
            return await connection.QueryFirstOrDefaultAsync<EnterpriseLead>(sql, new { Email = email });
        }

        public async Task<EnterpriseLead> CreateAsync(EnterpriseLead lead)
        {
            using var connection = await _connectionFactory.CreateConnectionAsync();
            var sql = @"
                INSERT INTO dbo.EnterpriseLeads (Id, Email, CompanyName, JobTitle, ExpectedVolume, IpAddress, CreatedAt)
                OUTPUT INSERTED.*
                VALUES (@Id, @Email, @CompanyName, @JobTitle, @ExpectedVolume, @IpAddress, SYSDATETIMEOFFSET());
            ";
            
            if (lead.Id == Guid.Empty) lead.Id = Guid.NewGuid();
            
            return await connection.QuerySingleAsync<EnterpriseLead>(sql, lead);
        }
    }
}
