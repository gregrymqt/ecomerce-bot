using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public sealed class AiCapacityRepository : IAiCapacityRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public AiCapacityRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<Guid> AddTopupAsync(AiProviderCredit credit, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = @"
            INSERT INTO dbo.AiProviderCredits 
                (Provider, AmountPaid, Currency, TokensCredited, BalanceRemaining, TransactionReference, Source, Notes)
            OUTPUT INSERTED.Id
            VALUES 
                (@Provider, @AmountPaid, @Currency, @TokensCredited, @BalanceRemaining, @TransactionReference, @Source, @Notes)";

        var cmd = new CommandDefinition(sql, new
        {
            Provider = credit.Provider.ToUpperInvariant(),
            credit.AmountPaid,
            Currency = string.IsNullOrWhiteSpace(credit.Currency) ? "USD" : credit.Currency.ToUpperInvariant(),
            credit.TokensCredited,
            credit.BalanceRemaining,
            credit.TransactionReference,
            Source = string.IsNullOrWhiteSpace(credit.Source) ? "MANUAL_ADMIN" : credit.Source.ToUpperInvariant(),
            credit.Notes
        }, cancellationToken: cancellationToken);

        return await connection.ExecuteScalarAsync<Guid>(cmd);
    }

    public async Task<List<AiProviderCredit>> GetRecentTopupsAsync(int limit = 20, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
        const string sql = @"
            SELECT TOP (@Limit) 
                Id, Provider, AmountPaid, Currency, TokensCredited, BalanceRemaining, TransactionReference, Source, Notes, CreatedAt
            FROM dbo.AiProviderCredits
            ORDER BY CreatedAt DESC";

        var cmd = new CommandDefinition(sql, new { Limit = limit }, cancellationToken: cancellationToken);
        var items = await connection.QueryAsync<AiProviderCredit>(cmd);
        return [.. items];
    }

    public async Task<Dictionary<string, decimal>> GetLatestBalancesAsync(CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
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

        var cmd = new CommandDefinition(sql, cancellationToken: cancellationToken);
        var rows = await connection.QueryAsync<(string Provider, decimal BalanceRemaining)>(cmd);
        var dict = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);

        foreach (var (Provider, BalanceRemaining) in rows)
        {
            dict[Provider] = BalanceRemaining;
        }

        // Garante que os 3 provedores existam no dicionário
        if (!dict.ContainsKey("DEEPSEEK")) dict["DEEPSEEK"] = 0m;
        if (!dict.ContainsKey("GEMINI")) dict["GEMINI"] = 0m;
        if (!dict.ContainsKey("OPENROUTER")) dict["OPENROUTER"] = 0m;

        return dict;
    }

    public async Task<List<DailyTokenUsageSummary>> GetDailyUsageHistoryAsync(int days = 90, CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
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

        var cmd = new CommandDefinition(sql, new { Days = days }, cancellationToken: cancellationToken);
        var rows = await connection.QueryAsync<DailyTokenUsageSummary>(cmd);
        return rows.ToList();
    }
}
