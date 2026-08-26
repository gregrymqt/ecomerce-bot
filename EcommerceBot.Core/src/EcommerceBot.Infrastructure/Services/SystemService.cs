using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.System;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Interfaces;
using StackExchange.Redis;
using CsvHelper;
using CsvHelper.Configuration;
using System.Globalization;
using Dapper;

namespace EcommerceBot.Infrastructure.Services;

public class SystemService : ISystemService
{
    private readonly IProductRepository _productRepository;
    private readonly IRobotActivityRepository _activityRepository;
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly IConnectionMultiplexer _redis;

    public SystemService(
        IProductRepository productRepository,
        IRobotActivityRepository activityRepository,
        IDbConnectionFactory dbConnectionFactory,
        IConnectionMultiplexer redis)
    {
        _productRepository = productRepository;
        _activityRepository = activityRepository;
        _dbConnectionFactory = dbConnectionFactory;
        _redis = redis;
    }

    public async Task<DashboardTelemetryResponse> GetTelemetryMetricsAsync(Guid tenantId, string timeframe)
    {
        var hours = timeframe switch
        {
            "7d" => 168,
            "30d" => 720,
            _ => 24
        };
        var timeSpan = TimeSpan.FromHours(hours);

        // 1. LlmUsageLogs aggregation instead of TokenTelemetryModel!
        using var conn = await _dbConnectionFactory.CreateConnectionAsync();
        var cutoff = DateTimeOffset.UtcNow.Subtract(timeSpan);
        var tokenSql = @"
            SELECT Provider, 
                   SUM(PromptTokens) as TotalPromptTokens, 
                   SUM(CompletionTokens) as TotalCompletionTokens, 
                   SUM(TotalTokens) as TotalTokens
            FROM dbo.LlmUsageLogs
            WHERE TenantId = @TenantId AND CreatedAt >= @Cutoff
            GROUP BY Provider";
            
        var tokenUsage = (await conn.QueryAsync<TokenTelemetrySchema>(tokenSql, new { TenantId = tenantId, Cutoff = cutoff })).ToList();

        // 2. Product status aggregation
        var statusSql = @"
            SELECT Status, COUNT(Id) as Count
            FROM dbo.Products
            WHERE TenantId = @TenantId AND CreatedAt >= @Cutoff
            GROUP BY Status";
        var statuses = await conn.QueryAsync(statusSql, new { TenantId = tenantId, Cutoff = cutoff });
        var productStatus = new ProductStatusSummary();
        foreach (var status in statuses)
        {
            var s = ((string)status.Status).ToLower();
            if (s == "raw") productStatus.Raw += (int)status.Count;
            else if (s == "processing") productStatus.Processing += (int)status.Count;
            else if (s == "processed") productStatus.Processed += (int)status.Count;
            else if (s == "failed") productStatus.Failed += (int)status.Count;
        }

        // 3. Average Latency
        var avgLatency = await _activityRepository.GetAverageLatencyAsync(tenantId, timeSpan);

        // 4. Hours Saved
        // Exemplo: 10 mins (0.16h) salvos por produto processado
        var hoursSaved = productStatus.Processed * 0.16;

        return new DashboardTelemetryResponse
        {
            ProductStatus = productStatus,
            TokenUsage = tokenUsage,
            AverageLatencyMs = avgLatency,
            HoursSaved = Math.Round(hoursSaved, 2)
        };
    }

    public async Task<IEnumerable<RobotActivityDto>> GetRecentActivitiesAsync(Guid tenantId, int limit, int page)
    {
        var offset = (page - 1) * limit;
        var activities = await _activityRepository.GetRecentAsync(tenantId, limit, offset);
        
        return activities.Select(a => new RobotActivityDto
        {
            Id = a.Id,
            WorkerType = a.WorkerType,
            Status = a.Status,
            DetailsJson = a.DetailsJson,
            DurationMs = a.DurationMs,
            CreatedAt = a.CreatedAt
        });
    }

    public async Task<SystemHealthResponse> CheckSystemHealthAsync()
    {
        var health = new SystemHealthResponse { Status = "OK", Services = new() };
        
        try
        {
            using var conn = await _dbConnectionFactory.CreateConnectionAsync();
            await conn.ExecuteScalarAsync<int>("SELECT 1");
            health.Services["SQLServer"] = "UP";
        }
        catch { health.Services["SQLServer"] = "DOWN"; health.Status = "DEGRADED"; }

        try
        {
            var db = _redis.GetDatabase();
            await db.PingAsync();
            health.Services["Redis"] = "UP";
        }
        catch { health.Services["Redis"] = "DOWN"; health.Status = "DEGRADED"; }

        return health;
    }

    public async Task ProcessDemoRequestAsync(List<string> urls)
    {
        // Publica na fila (poderia ser MassTransit IBus, mas simplificando)
        // O C# processaria isso ou publicaria via RabbitMQ
        await Task.CompletedTask;
    }

    public async Task ExportDataToStreamAsync(Guid tenantId, string platform, StreamWriter writer)
    {
        // Usamos Dapper unbuffered query stream
        using var conn = await _dbConnectionFactory.CreateConnectionAsync();
        var sql = "SELECT Sku, Title, Price, Status, Category, SeoKeywords FROM dbo.Products WHERE TenantId = @TenantId";
        var products = await conn.QueryAsync<dynamic>(sql, new { TenantId = tenantId }); // In production use buffered=false or specific reader
        
        var config = new CsvConfiguration(CultureInfo.InvariantCulture) { Delimiter = "," };
        using var csv = new CsvWriter(writer, config);
        
        // Write Headers
        csv.WriteField("SKU");
        csv.WriteField("Title");
        csv.WriteField("Price");
        csv.WriteField("Status");
        csv.WriteField("Category");
        csv.WriteField("SeoKeywords");
        await csv.NextRecordAsync();

        foreach (var p in products)
        {
            csv.WriteField(p.Sku);
            csv.WriteField(p.Title);
            csv.WriteField(p.Price);
            csv.WriteField(p.Status);
            csv.WriteField(p.Category);
            csv.WriteField(p.SeoKeywords);
            await csv.NextRecordAsync();
        }
    }
}
