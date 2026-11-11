using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using CsvHelper;
using CsvHelper.Configuration;
using Dapper;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Application.DTOs.System;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Application.Security;
using EcommerceBot.Domain.Interfaces;
using MassTransit;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace EcommerceBot.Infrastructure.Services;

public sealed class SystemService : ISystemService
{
    private readonly IProductRepository _productRepository;
    private readonly IRobotActivityRepository _activityRepository;
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<SystemService> _logger;
    private readonly ISendEndpointProvider? _sendEndpointProvider;

    public SystemService(
        IProductRepository productRepository,
        IRobotActivityRepository activityRepository,
        IDbConnectionFactory dbConnectionFactory,
        IConnectionMultiplexer redis,
        ILogger<SystemService> logger,
        ISendEndpointProvider? sendEndpointProvider = null)
    {
        _productRepository = productRepository;
        _activityRepository = activityRepository;
        _dbConnectionFactory = dbConnectionFactory;
        _redis = redis;
        _logger = logger;
        _sendEndpointProvider = sendEndpointProvider;
    }

    public async Task<DashboardTelemetryResponse> GetTelemetryMetricsAsync(Guid tenantId, string timeframe, CancellationToken cancellationToken = default)
    {
        var hours = timeframe switch
        {
            "7d" => 168,
            "30d" => 720,
            _ => 24
        };
        var timeSpan = TimeSpan.FromHours(hours);

        try
        {
            // 1. LlmUsageLogs aggregation instead of TokenTelemetryModel!
            using var conn = await _dbConnectionFactory.CreateConnectionAsync(tenantId, cancellationToken);
            var cutoff = DateTimeOffset.UtcNow.Subtract(timeSpan);
            var tokenSql = @"
                SELECT Provider, 
                       SUM(PromptTokens) as TotalPromptTokens, 
                       SUM(CompletionTokens) as TotalCompletionTokens, 
                       SUM(TotalTokens) as TotalTokens
                FROM dbo.LlmUsageLogs
                WHERE TenantId = @TenantId AND CreatedAt >= @Cutoff
                GROUP BY Provider";
                
            var tokenUsage = (await conn.QueryAsync<TokenTelemetrySchema>(new CommandDefinition(tokenSql, new { TenantId = tenantId, Cutoff = cutoff }, cancellationToken: cancellationToken))).ToList();

            // 2. Product status aggregation
            var statusSql = @"
                SELECT Status, COUNT(Id) as Count
                FROM dbo.Products
                WHERE TenantId = @TenantId AND CreatedAt >= @Cutoff
                GROUP BY Status";
            var statuses = await conn.QueryAsync(new CommandDefinition(statusSql, new { TenantId = tenantId, Cutoff = cutoff }, cancellationToken: cancellationToken));
            int raw = 0, processing = 0, processed = 0, failed = 0;
            foreach (var status in statuses)
            {
                var s = ((string)status.Status).ToLower();
                if (s == "raw") raw += (int)status.Count;
                else if (s == "processing") processing += (int)status.Count;
                else if (s == "processed") processed += (int)status.Count;
                else if (s == "failed") failed += (int)status.Count;
            }

            var productStatus = new ProductStatusSummary
            {
                Raw = raw,
                Processing = processing,
                Processed = processed,
                Failed = failed
            };

            // 3. Average Latency
            var avgLatency = await _activityRepository.GetAverageLatencyAsync(tenantId, timeSpan, cancellationToken);

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
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter métricas de telemetria para o Tenant {TenantId} (Timeframe: {Timeframe})", tenantId, timeframe);
            throw;
        }
    }

    public async Task<IEnumerable<RobotActivityDto>> GetRecentActivitiesAsync(Guid tenantId, int limit, int page, CancellationToken cancellationToken = default)
    {
        try
        {
            var offset = (page - 1) * limit;
            var activities = await _activityRepository.GetRecentAsync(tenantId, limit, offset, cancellationToken);
            
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
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao listar atividades recentes do robô para o Tenant {TenantId}", tenantId);
            throw;
        }
    }

    public async Task<SystemHealthResponse> CheckSystemHealthAsync(CancellationToken cancellationToken = default)
    {
        var services = new Dictionary<string, string>();
        var status = "OK";
        
        try
        {
            using var conn = await _dbConnectionFactory.CreateConnectionAsync(cancellationToken);
            await conn.ExecuteScalarAsync<int>(new CommandDefinition("SELECT 1", cancellationToken: cancellationToken));
            services["SQLServer"] = "UP";
        }
        catch (Exception ex)
        { 
            _logger.LogError(ex, "Sonda de saúde do SQL Server falhou.");
            services["SQLServer"] = "DOWN"; 
            status = "DEGRADED"; 
        }

        try
        {
            var db = _redis.GetDatabase();
            await db.PingAsync();
            services["Redis"] = "UP";
        }
        catch (Exception ex)
        { 
            _logger.LogError(ex, "Sonda de saúde do Redis falhou.");
            services["Redis"] = "DOWN"; 
            status = "DEGRADED"; 
        }

        return new SystemHealthResponse 
        { 
            Status = status, 
            Services = services 
        };
    }

    public async Task ProcessDemoRequestAsync(List<string> urls, CancellationToken cancellationToken = default)
    {
        if (urls == null || urls.Count == 0)
            throw new ArgumentException("Ao menos uma URL deve ser informada.", nameof(urls));

        if (urls.Count > 3)
            throw new ArgumentException("O limite máximo permitido é de 3 URLs para a demonstração.", nameof(urls));

        var validatedUrls = new List<string>(urls.Count);
        foreach (var rawUrl in urls)
        {
            if (string.IsNullOrWhiteSpace(rawUrl) ||
                !await UrlSecurityValidator.IsSafePublicUrlAsync(rawUrl, cancellationToken: cancellationToken))
            {
                throw new ArgumentException($"URL inválida ou bloqueada por política de segurança Anti-SSRF: '{rawUrl}'.", nameof(urls));
            }
            validatedUrls.Add(rawUrl.Trim());
        }

        if (_sendEndpointProvider == null)
        {
            throw new InvalidOperationException("ISendEndpointProvider não configurado para enfileiramento de demonstração.");
        }

        var endpoint = await _sendEndpointProvider.GetSendEndpoint(new Uri("exchange:demo_ecommerce"));
        foreach (var url in validatedUrls)
        {
            var sku = $"demo_{Guid.NewGuid().ToString("N")[..11]}";
            await endpoint.Send(new ScrapingRequestMessage
            {
                TenantId = Guid.Empty,
                Sku = sku,
                Url = url,
                PromptContext = "demo",
                IsByok = false
            }, cancellationToken);
        }

        _logger.LogInformation("Enfileiradas {Count} URLs para demonstração pública em exchange:demo_ecommerce.", validatedUrls.Count);
    }

    public async Task ExportDataToStreamAsync(Guid tenantId, string platform, Stream outputStream, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(outputStream);

        using var conn = await _dbConnectionFactory.CreateConnectionAsync(tenantId, cancellationToken);
        var normalizedPlatform = platform?.Trim().ToLowerInvariant() ?? "all";

        var platformFilter = normalizedPlatform switch
        {
            "shopify" => " AND (ShopifyProductId IS NOT NULL OR LOWER(ISNULL(SourceUrl, '')) LIKE '%shopify%')",
            "nuvemshop" => " AND (NuvemshopProductId IS NOT NULL OR LOWER(ISNULL(SourceUrl, '')) LIKE '%nuvemshop%' OR LOWER(ISNULL(SourceUrl, '')) LIKE '%tiendanube%')",
            _ => string.Empty
        };

        var sql = $@"
            SELECT Sku, Title, Price, OriginalPrice, Status, Category, Brand, StockQuantity, EnrichmentMetadata
            FROM dbo.Products
            WHERE TenantId = @TenantId{platformFilter}
            ORDER BY CreatedAt DESC;";

        var products = await conn.QueryAsync<dynamic>(new CommandDefinition(sql, new { TenantId = tenantId }, cancellationToken: cancellationToken));

        var config = new CsvConfiguration(CultureInfo.InvariantCulture) { Delimiter = "," };
        using var stringWriter = new StringWriter(CultureInfo.InvariantCulture);
        using var csv = new CsvWriter(stringWriter, config);

        csv.WriteField("SKU");
        csv.WriteField("Title");
        csv.WriteField("Price");
        csv.WriteField("OriginalPrice");
        csv.WriteField("Status");
        csv.WriteField("Category");
        csv.WriteField("Brand");
        csv.WriteField("StockQuantity");
        csv.WriteField("SeoKeywords");
        await csv.NextRecordAsync();

        var batchCounter = 0;
        foreach (var p in products)
        {
            csv.WriteField(SanitizeCsvCell((string?)p.Sku));
            csv.WriteField(SanitizeCsvCell((string?)p.Title));
            csv.WriteField(p.Price);
            csv.WriteField(p.OriginalPrice);
            csv.WriteField(SanitizeCsvCell((string?)p.Status));
            csv.WriteField(SanitizeCsvCell((string?)p.Category));
            csv.WriteField(SanitizeCsvCell((string?)p.Brand));
            csv.WriteField(p.StockQuantity);
            csv.WriteField(SanitizeCsvCell(ExtractSeoKeywords((string?)p.EnrichmentMetadata)));
            await csv.NextRecordAsync();

            batchCounter++;
            if (batchCounter >= 100)
            {
                await FlushBufferAsync(stringWriter, outputStream, cancellationToken);
                batchCounter = 0;
            }
        }

        await FlushBufferAsync(stringWriter, outputStream, cancellationToken);
        await outputStream.FlushAsync(cancellationToken);
    }

    private static async Task FlushBufferAsync(StringWriter stringWriter, Stream outputStream, CancellationToken cancellationToken)
    {
        var sb = stringWriter.GetStringBuilder();
        if (sb.Length == 0) return;

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        sb.Clear();
        await outputStream.WriteAsync(bytes, cancellationToken);
    }

    private static string ExtractSeoKeywords(string? enrichmentMetadataJson)
    {
        if (string.IsNullOrWhiteSpace(enrichmentMetadataJson))
            return string.Empty;

        try
        {
            using var doc = JsonDocument.Parse(enrichmentMetadataJson);
            if (doc.RootElement.TryGetProperty("seoKeywords", out var kwEl) && kwEl.ValueKind == JsonValueKind.Array)
            {
                return string.Join(", ", kwEl.EnumerateArray().Select(e => e.GetString()).Where(s => !string.IsNullOrWhiteSpace(s)));
            }
        }
        catch (JsonException)
        {
        }

        return string.Empty;
    }

    private static string SanitizeCsvCell(string? value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        return value[0] is '=' or '+' or '-' or '@' or '\t' or '\r'
            ? $"'{value}"
            : value;
    }
}
