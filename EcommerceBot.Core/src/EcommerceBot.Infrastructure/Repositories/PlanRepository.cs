using System;
using System.Collections.Generic;
using System.Data;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Options;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace EcommerceBot.Infrastructure.Repositories;

public class PlanRepository : IPlanRepository
{
    private readonly string _connectionString;

    public PlanRepository(IOptions<DatabaseOptions> databaseOptions)
    {
        _connectionString = databaseOptions.Value.DefaultConnection;

        if (string.IsNullOrWhiteSpace(_connectionString))
        {
            throw new ArgumentNullException(nameof(databaseOptions), "DefaultConnection string is required for PlanRepository.");
        }
    }

    private IDbConnection CreateConnection() => new SqlConnection(_connectionString);

    public async Task<Plan?> GetByIdAsync(Guid id)
    {
        using var connection = CreateConnection();
        const string sql = "SELECT * FROM dbo.Plans WHERE Id = @Id;";
        return await connection.QuerySingleOrDefaultAsync<Plan>(sql, new { Id = id });
    }

    public async Task<IEnumerable<Plan>> GetAllAsync(bool onlyActive = false)
    {
        using var connection = CreateConnection();
        string sql = "SELECT * FROM dbo.Plans";
        
        if (onlyActive)
            sql += " WHERE IsActive = 1";
            
        sql += " ORDER BY Price ASC;";
        
        return await connection.QueryAsync<Plan>(sql);
    }

    public async Task<Guid> CreateAsync(Plan plan)
    {
        using var connection = CreateConnection();
        const string sql = @"
            INSERT INTO dbo.Plans (
                Name, Description, Price, CreditsIncluded, BillingInterval, 
                MpPreapprovalPlanId, TrialDays, IsActive
            )
            OUTPUT INSERTED.Id
            VALUES (
                @Name, @Description, @Price, @CreditsIncluded, @BillingInterval, 
                @MpPreapprovalPlanId, @TrialDays, @IsActive
            );";
            
        return await connection.QuerySingleAsync<Guid>(sql, plan);
    }

    public async Task UpdateAsync(Plan plan)
    {
        using var connection = CreateConnection();
        const string sql = @"
            UPDATE dbo.Plans SET
                Name = @Name,
                Description = @Description,
                Price = @Price,
                CreditsIncluded = @CreditsIncluded,
                BillingInterval = @BillingInterval,
                MpPreapprovalPlanId = @MpPreapprovalPlanId,
                TrialDays = @TrialDays,
                IsActive = @IsActive,
                UpdatedAt = SYSDATETIMEOFFSET()
            WHERE Id = @Id;";
            
        await connection.ExecuteAsync(sql, plan);
    }
}
