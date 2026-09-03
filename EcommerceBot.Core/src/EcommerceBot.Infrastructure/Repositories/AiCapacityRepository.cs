using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public class AiCapacityRepository : IAiCapacityRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public AiCapacityRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<Guid> AddTopupAsync(AiProviderCredit credit)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = @"
            INSERT INTO dbo.AiProviderCredits 
                (Provider, AmountPaid, Currency, TokensCredited, BalanceRemaining, TransactionReference, Source, Notes)
            OUTPUT INSERTED.Id
            VALUES 
                (@Provider, @AmountPaid, @Currency, @TokensCredited, @BalanceRemaining, @TransactionReference, @Source, @Notes)";

        var id = await connection.ExecuteScalarAsync<Guid>(sql, new
        {
            Provider = credit.Provider.ToUpperInvariant(),
            credit.AmountPaid,
            Currency = string.IsNullOrWhiteSpace(credit.Currency) ? "USD" : credit.Currency.ToUpperInvariant(),
            credit.TokensCredited,
            credit.BalanceRemaining,
            credit.TransactionReference,
            Source = string.IsNullOrWhiteSpace(credit.Source) ? "MANUAL_ADMIN" : credit.Source.ToUpperInvariant(),
            credit.Notes
        });

        return id;
    }

    public async Task<List<AiProviderCredit>> GetRecentTopupsAsync(int limit = 20)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = @"
            SELECT TOP (@Limit) 
                Id, Provider, AmountPaid, Currency, TokensCredited, BalanceRemaining, TransactionReference, Source, Notes, CreatedAt
            FROM dbo.AiProviderCredits
            ORDER BY CreatedAt DESC";

        var items = await connection.QueryAsync<AiProviderCredit>(sql, new { Limit = limit });
        return items.ToList();
    }

    public async Task<Dictionary<string, decimal>> GetLatestBalancesAsync()
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = @"
            WITH RankedCredits AS (
                SELECT 
                    Provider,
                    BalanceRemaining,
                    ROW_NUMBER() OVER(PARTITION BY Provider ORDER BY CreatedAt DESC) as rn
                FROM dbo.AiProviderCredits
            )
            SELECT Provider, BalanceRemaining
            FROM RankedCredits
            WHERE rn = 1";

        var rows = await connection.QueryAsync<(string Provider, decimal BalanceRemaining)>(sql);
        var dict = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in rows)
        {
            dict[row.Provider] = row.BalanceRemaining;
        }

        // Garante que os 3 provedores existam no dicionário
        if (!dict.ContainsKey("DEEPSEEK")) dict["DEEPSEEK"] = 0m;
        if (!dict.ContainsKey("GEMINI")) dict["GEMINI"] = 0m;
        if (!dict.ContainsKey("OPENROUTER")) dict["OPENROUTER"] = 0m;

        return dict;
    }

    public async Task<List<DailyTokenUsageSummary>> GetDailyUsageHistoryAsync(int days = 90)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = @"
            SELECT 
                CONVERT(VARCHAR(10), CreatedAt, 120) AS [Date],
                UPPER(Provider) AS Provider,
                COALESCE(SUM(TotalTokens), 0) AS Tokens,
                COALESCE(SUM(EstimatedCostUsd), 0) AS CostUsd
            FROM dbo.LLMUsageLogs
            WHERE CreatedAt >= DATEADD(day, -@Days, SYSDATETIMEOFFSET())
            GROUP BY CONVERT(VARCHAR(10), CreatedAt, 120), UPPER(Provider)
            ORDER BY [Date] ASC";

        var rows = await connection.QueryAsync<DailyTokenUsageSummary>(sql, new { Days = days });
        return rows.ToList();
    }
}
