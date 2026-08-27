using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Application.DTOs.Admin;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Infrastructure.Repositories;

public class SaasAnalyticsRepository : ISaasAnalyticsRepository
{
    private readonly IDbConnection _db;

    public SaasAnalyticsRepository(IDbConnection db)
    {
        _db = db;
    }

    public async Task<Guid> RecordVisitAsync(SaasTrafficVisit visit)
    {
        const string sql = @"
            INSERT INTO dbo.SaasTrafficVisits (
                Id, SessionId, Path, UtmSource, UtmMedium, UtmCampaign, UtmContent, UtmTerm,
                AdId, FbClid, GClid, IpAddress, UserAgent, Referrer, CreatedAt
            ) VALUES (
                @Id, @SessionId, @Path, @UtmSource, @UtmMedium, @UtmCampaign, @UtmContent, @UtmTerm,
                @AdId, @FbClid, @GClid, @IpAddress, @UserAgent, @Referrer, @CreatedAt
            );";

        if (visit.Id == Guid.Empty) visit.Id = Guid.NewGuid();
        if (visit.CreatedAt == default) visit.CreatedAt = DateTimeOffset.UtcNow;

        await _db.ExecuteAsync(sql, visit);
        return visit.Id;
    }

    public async Task<AcquisitionFunnelResponseDto> GetAcquisitionFunnelAsync(int days)
    {
        var since = DateTimeOffset.UtcNow.AddDays(-days);

        const string sql = @"
            -- Total de Visitantes Únicos (SessionId) na Landing Page
            SELECT COUNT(DISTINCT SessionId) 
            FROM dbo.SaasTrafficVisits
            WHERE CreatedAt >= @Since;

            -- Total de Novos Cadastros de Tenants
            SELECT COUNT(1) 
            FROM dbo.Tenants
            WHERE CreatedAt >= @Since;

            -- Total de Clientes Pagantes Únicos com Ordens Aprovadas
            SELECT COUNT(DISTINCT TenantId) 
            FROM dbo.Orders
            WHERE Status = 'approved' AND CreatedAt >= @Since;
        ";

        using var multi = await _db.QueryMultipleAsync(sql, new { Since = since });
        var totalVisitors = await multi.ReadSingleAsync<int>();
        var totalSignups = await multi.ReadSingleAsync<int>();
        var totalPaying = await multi.ReadSingleAsync<int>();

        // Evita divisão por zero
        var visitorToSignup = totalVisitors > 0 ? (decimal)totalSignups / totalVisitors * 100m : 0m;
        var signupToPaid = totalSignups > 0 ? (decimal)totalPaying / totalSignups * 100m : 0m;
        var overallConv = totalVisitors > 0 ? (decimal)totalPaying / totalVisitors * 100m : 0m;

        return new AcquisitionFunnelResponseDto
        {
            TotalVisitors = totalVisitors,
            TotalSignups = totalSignups,
            TotalPayingCustomers = totalPaying,
            VisitorToSignupRate = Math.Round(visitorToSignup, 2),
            SignupToPaidRate = Math.Round(signupToPaid, 2),
            OverallConversionRate = Math.Round(overallConv, 2),
            PeriodDays = days
        };
    }

    public async Task<UnitEconomicsResponseDto> GetUnitEconomicsAsync(int days)
    {
        var since = DateTimeOffset.UtcNow.AddDays(-days);

        // 1. Total Ad Spend
        const string spendSql = @"
            SELECT ISNULL(SUM(AmountSpentBrl), 0.00) 
            FROM dbo.SaasAdSpends
            WHERE PeriodStart >= @Since;
        ";
        var totalAdSpend = await _db.ExecuteScalarAsync<decimal>(spendSql, new { Since = since });

        // 2. Receita Bruta Total e Custo de IA Total
        const string revenueSql = @"
            SELECT ISNULL(SUM(TotalAmount), 0.00) 
            FROM dbo.Orders
            WHERE Status = 'approved' AND CreatedAt >= @Since;
        ";
        var totalRevenue = await _db.ExecuteScalarAsync<decimal>(revenueSql, new { Since = since });

        const string llmCostSql = @"
            SELECT ISNULL(SUM(EstimatedCostUsd * 5.70), 0.00) -- Conversão estimada USD para BRL
            FROM dbo.LLMUsageLogs
            WHERE CreatedAt >= @Since;
        ";
        var totalLlmCost = await _db.ExecuteScalarAsync<decimal>(llmCostSql, new { Since = since });

        // 3. Performance agrupada por Campanha / UTM Source
        const string campaignsSql = @"
            SELECT 
                ISNULL(t.FirstUtmSource, 'Direto/Organico') AS UtmSource,
                ISNULL(t.FirstUtmCampaign, 'Sem Campanha') AS UtmCampaign,
                t.FirstAdId AS AdId,
                COUNT(DISTINCT t.Id) AS SignupsCount,
                COUNT(DISTINCT o.TenantId) AS PayingCustomersCount,
                ISNULL(SUM(o.TotalAmount), 0.00) AS GrossRevenueBrl
            FROM dbo.Tenants t
            LEFT JOIN dbo.Orders o ON o.TenantId = t.Id AND o.Status = 'approved' AND o.CreatedAt >= @Since
            WHERE t.CreatedAt >= @Since
            GROUP BY t.FirstUtmSource, t.FirstUtmCampaign, t.FirstAdId;
        ";

        var campaignRows = (await _db.QueryAsync<dynamic>(campaignsSql, new { Since = since })).ToList();

        var campaignsList = new List<CampaignPerformanceRowDto>();
        foreach (var row in campaignRows)
        {
            string source = row.UtmSource ?? "Direto/Organico";
            string campaign = row.UtmCampaign ?? "Sem Campanha";
            string? adId = row.AdId;
            int signups = (int)row.SignupsCount;
            int paying = (int)row.PayingCustomersCount;
            decimal grossRev = (decimal)row.GrossRevenueBrl;

            // Busca custo de IA consumido pelos tenants dessa campanha
            const string campaignLlmSql = @"
                SELECT ISNULL(SUM(l.EstimatedCostUsd * 5.70), 0.00)
                FROM dbo.LLMUsageLogs l
                INNER JOIN dbo.Tenants t ON t.Id = l.TenantId
                WHERE t.FirstUtmSource = @Source 
                  AND (t.FirstUtmCampaign = @Campaign OR (@Campaign = 'Sem Campanha' AND t.FirstUtmCampaign IS NULL))
                  AND l.CreatedAt >= @Since;
            ";
            var campaignLlmCost = await _db.ExecuteScalarAsync<decimal>(campaignLlmSql, new { Source = source, Campaign = campaign, Since = since });

            // Busca gasto em ads para essa campanha específica
            const string campaignSpendSql = @"
                SELECT ISNULL(SUM(AmountSpentBrl), 0.00)
                FROM dbo.SaasAdSpends
                WHERE UtmSource = @Source AND CampaignName = @Campaign AND PeriodStart >= @Since;
            ";
            var campaignSpend = await _db.ExecuteScalarAsync<decimal>(campaignSpendSql, new { Source = source, Campaign = campaign, Since = since });

            var netMargin = grossRev - campaignLlmCost - campaignSpend;
            var roas = campaignSpend > 0 ? Math.Round(grossRev / campaignSpend, 2) : 0m;
            var cac = paying > 0 ? Math.Round(campaignSpend / paying, 2) : 0m;

            campaignsList.Add(new CampaignPerformanceRowDto
            {
                UtmSource = source,
                UtmCampaign = campaign,
                AdId = adId,
                SignupsCount = signups,
                PayingCustomersCount = paying,
                GrossRevenueBrl = grossRev,
                LlmCostBrl = Math.Round(campaignLlmCost, 2),
                AdSpendBrl = campaignSpend,
                NetMarginBrl = Math.Round(netMargin, 2),
                Roas = roas,
                CacBrl = cac
            });
        }

        // Totais agregados
        const string payingCountSql = "SELECT COUNT(DISTINCT TenantId) FROM dbo.Orders WHERE Status = 'approved' AND CreatedAt >= @Since;";
        var totalPayingCustomers = await _db.ExecuteScalarAsync<int>(payingCountSql, new { Since = since });

        var avgCac = totalPayingCustomers > 0 ? Math.Round(totalAdSpend / totalPayingCustomers, 2) : 0m;
        var avgLtv = totalPayingCustomers > 0 ? Math.Round(totalRevenue / totalPayingCustomers, 2) : 0m;
        var ltvCac = avgCac > 0 ? Math.Round(avgLtv / avgCac, 2) : 0m;
        var netProfit = totalRevenue - totalLlmCost - totalAdSpend;

        return new UnitEconomicsResponseDto
        {
            TotalAdSpendBrl = totalAdSpend,
            TotalGrossRevenueBrl = totalRevenue,
            TotalLlmCostBrl = Math.Round(totalLlmCost, 2),
            NetProfitBrl = Math.Round(netProfit, 2),
            AverageCacBrl = avgCac,
            AverageLtvBrl = avgLtv,
            LtvCacRatio = ltvCac,
            PaybackMonths = avgCac > 0 && avgLtv > 0 ? Math.Round((avgCac / (avgLtv / 12)), 1) : 1.0m,
            Campaigns = campaignsList
        };
    }

    public async Task<Guid> CreateAdSpendAsync(SaasAdSpend adSpend)
    {
        const string sql = @"
            INSERT INTO dbo.SaasAdSpends (
                Id, CampaignName, UtmSource, AdId, AmountSpentBrl, PeriodStart, PeriodEnd, Notes, CreatedAt
            ) VALUES (
                @Id, @CampaignName, @UtmSource, @AdId, @AmountSpentBrl, @PeriodStart, @PeriodEnd, @Notes, @CreatedAt
            );";

        if (adSpend.Id == Guid.Empty) adSpend.Id = Guid.NewGuid();
        if (adSpend.CreatedAt == default) adSpend.CreatedAt = DateTimeOffset.UtcNow;

        await _db.ExecuteAsync(sql, adSpend);
        return adSpend.Id;
    }

    public async Task<IEnumerable<SaasAdSpend>> GetAdSpendsAsync(int days)
    {
        var since = DateTimeOffset.UtcNow.AddDays(-days);
        const string sql = @"
            SELECT * FROM dbo.SaasAdSpends
            WHERE PeriodStart >= @Since
            ORDER BY PeriodStart DESC;
        ";
        return await _db.QueryAsync<SaasAdSpend>(sql, new { Since = since });
    }
}
