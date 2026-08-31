using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Application.DTOs.Analytics;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public class TrafficAttributionRepository : ITrafficAttributionRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public TrafficAttributionRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<Guid> RecordTenantVisitAsync(TrafficAttribution attribution)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = @"
            INSERT INTO dbo.TrafficAttributions (
                Id, TenantId, OrderId, SessionId, UtmSource, UtmMedium, UtmCampaign,
                UtmTerm, UtmContent, AdId, FbClid, GClid, IpAddress, UserAgent, CreatedAt
            ) VALUES (
                @Id, @TenantId, @OrderId, @SessionId, @UtmSource, @UtmMedium, @UtmCampaign,
                @UtmTerm, @UtmContent, @AdId, @FbClid, @GClid, @IpAddress, @UserAgent, @CreatedAt
            );";

        if (attribution.Id == Guid.Empty) attribution.Id = Guid.NewGuid();
        if (attribution.CreatedAt == default) attribution.CreatedAt = DateTimeOffset.UtcNow;

        await connection.ExecuteAsync(sql, attribution);
        return attribution.Id;
    }

    public async Task<TenantTrafficOverviewDto> GetTenantTrafficOverviewAsync(Guid tenantId, int days, string? sourceFilter = null)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        var since = DateTimeOffset.UtcNow.AddDays(-days);

        // 1. Resumo Geral de Faturamento e Pedidos Atribuídos
        const string summarySql = @"
            SELECT 
                ISNULL(SUM(o.TotalAmount), 0.00) AS TotalAttributedRevenue,
                COUNT(DISTINCT o.Id) AS TotalTrackedOrders,
                COUNT(DISTINCT t.SessionId) AS TotalVisits
            FROM dbo.TrafficAttributions t
            LEFT JOIN dbo.Orders o ON o.Id = t.OrderId AND o.TenantId = @TenantId AND o.Status = 'approved'
            WHERE t.TenantId = @TenantId AND t.CreatedAt >= @Since
              AND (@SourceFilter IS NULL OR t.UtmSource = @SourceFilter);
        ";

        var summary = await connection.QueryFirstOrDefaultAsync<dynamic>(summarySql, new 
        { 
            TenantId = tenantId, 
            Since = since,
            SourceFilter = string.IsNullOrWhiteSpace(sourceFilter) ? null : sourceFilter
        });

        decimal totalRevenue = summary != null ? (decimal)summary.TotalAttributedRevenue : 0m;
        int totalOrders = summary != null ? (int)summary.TotalTrackedOrders : 0;
        int totalVisits = summary != null ? (int)summary.TotalVisits : 0;
        decimal avgTicket = totalOrders > 0 ? Math.Round(totalRevenue / totalOrders, 2) : 0m;

        // 2. Performance por Canal / Origem
        const string sourcesSql = @"
            SELECT 
                ISNULL(t.UtmSource, 'Direto/Organico') AS Source,
                COUNT(DISTINCT t.SessionId) AS VisitsCount,
                COUNT(DISTINCT t.OrderId) AS OrdersCount,
                ISNULL(SUM(o.TotalAmount), 0.00) AS RevenueBrl
            FROM dbo.TrafficAttributions t
            LEFT JOIN dbo.Orders o ON o.Id = t.OrderId AND o.TenantId = @TenantId AND o.Status = 'approved'
            WHERE t.TenantId = @TenantId AND t.CreatedAt >= @Since
            GROUP BY t.UtmSource
            ORDER BY RevenueBrl DESC;
        ";

        var sourceRows = (await connection.QueryAsync<dynamic>(sourcesSql, new { TenantId = tenantId, Since = since })).ToList();
        var sourcesList = sourceRows.Select(r => 
        {
            int visits = (int)r.VisitsCount;
            int orders = (int)r.OrdersCount;
            decimal rev = (decimal)r.RevenueBrl;
            decimal conv = visits > 0 ? Math.Round((decimal)orders / visits * 100m, 2) : 0m;

            return new SourcePerformanceDto
            {
                Source = r.Source,
                VisitsCount = visits,
                OrdersCount = orders,
                ConversionRate = conv,
                RevenueBrl = rev
            };
        }).ToList();

        // 3. Performance por Criativo / Anúncio (ad_id)
        const string creativesSql = @"
            SELECT 
                ISNULL(t.AdId, 'Sem ID de Anúncio') AS AdId,
                ISNULL(t.UtmCampaign, 'Sem Campanha') AS Campaign,
                ISNULL(t.UtmSource, 'meta_ads') AS Source,
                COUNT(DISTINCT t.OrderId) AS OrdersCount,
                ISNULL(SUM(o.TotalAmount), 0.00) AS TotalRevenueBrl
            FROM dbo.TrafficAttributions t
            INNER JOIN dbo.Orders o ON o.Id = t.OrderId AND o.TenantId = @TenantId AND o.Status = 'approved'
            WHERE t.TenantId = @TenantId AND t.CreatedAt >= @Since AND t.AdId IS NOT NULL
            GROUP BY t.AdId, t.UtmCampaign, t.UtmSource
            ORDER BY TotalRevenueBrl DESC;
        ";

        var creativeRows = (await connection.QueryAsync<dynamic>(creativesSql, new { TenantId = tenantId, Since = since })).ToList();
        var creativesList = creativeRows.Select(r => 
        {
            int orders = (int)r.OrdersCount;
            decimal rev = (decimal)r.TotalRevenueBrl;
            decimal avg = orders > 0 ? Math.Round(rev / orders, 2) : 0m;

            return new CreativePerformanceDto
            {
                AdId = r.AdId,
                Campaign = r.Campaign,
                Source = r.Source,
                OrdersCount = orders,
                TotalRevenueBrl = rev,
                AverageTicketBrl = avg
            };
        }).ToList();

        string topSource = sourcesList.FirstOrDefault()?.Source ?? "Direto / Orgânico";

        return new TenantTrafficOverviewDto
        {
            TotalAttributedRevenueBrl = totalRevenue,
            TotalTrackedOrders = totalOrders,
            TotalVisits = totalVisits,
            AverageTicketBrl = avgTicket,
            TopSource = topSource,
            PeriodDays = days,
            Sources = sourcesList,
            Creatives = creativesList
        };
    }

    public async Task<int> LinkOrderToTrafficSessionAsync(Guid tenantId, Guid orderId, string sessionId, string? utmSource, string? utmCampaign, string? adId)
    {
        using var connection = await _connectionFactory.CreateConnectionAsync();
        const string sql = @"
            UPDATE dbo.TrafficAttributions
            SET OrderId = @OrderId
            WHERE TenantId = @TenantId 
              AND (SessionId = @SessionId OR (UtmSource = @UtmSource AND UtmCampaign = @UtmCampaign AND AdId = @AdId))
              AND OrderId IS NULL;
        ";

        return await connection.ExecuteAsync(sql, new 
        { 
            TenantId = tenantId, 
            OrderId = orderId, 
            SessionId = sessionId,
            UtmSource = utmSource,
            UtmCampaign = utmCampaign,
            AdId = adId
        });
    }
}
