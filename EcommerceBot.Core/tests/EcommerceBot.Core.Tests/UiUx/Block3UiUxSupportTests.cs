using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Linq;
using System.Reflection;
using System.Security.Claims;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Api.Middlewares;
using EcommerceBot.Api.Services;
using EcommerceBot.Application.DTOs.Ai;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Application.Interfaces.Gateways;
using EcommerceBot.Core.Tests.Security;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Services;
using FluentAssertions;
using MassTransit;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using StackExchange.Redis;
using Xunit;

namespace EcommerceBot.Core.Tests.UiUx;

public sealed class Block3UiUxSupportTests
{
    [Fact]
    public async Task CatalogService_RegenerateProductCopyAsync_DeductsCredit_PersistsAndLogs_OrRefundsOnFailure()
    {
        var tenantId = Guid.NewGuid();
        var userRepo = new InMemoryUserRepository();
        var tenantRepo = new InMemoryTenantRepository(userRepo);
        tenantRepo.Tenants[tenantId] = new Tenant { Id = tenantId, Name = "Loja Copy", IsActive = true, CreditsBalance = 3 };

        var productRepo = new InMemoryCatalogProductRepository();
        await productRepo.AddAsync(new Product
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Sku = "SKU-REGEN-01",
            Title = "Tênis Esportivo",
            Description = "Confortável",
            Category = "Calçados",
            Price = 199.90m,
            Status = "RAW",
            SourceUrl = "https://loja.com/tenis"
        });

        var credRepo = new StubByokCredentialRepository(hasActiveByok: false);
        var meteringRepo = new RecordingMeteringRepo();
        var gateway = new StubOpenRouterGateway(failWithFallback: false);

        var service = new CatalogService(
            productRepo,
            tenantRepo,
            credRepo,
            new NoopSendEndpointProvider(),
            NullLogger<CatalogService>.Instance,
            gateway,
            new NullSeoGuidelineRepo(),
            meteringRepo);

        var result = await service.RegenerateProductCopyAsync(tenantId, "SKU-REGEN-01");

        result.Should().NotBeNull();
        result!.Title.Should().Be("Tênis Esportivo Alta Performance SEO");
        result.Description.Should().Be("Descrição otimizada por IA");
        result.Status.Should().Be("PROCESSED");
        tenantRepo.Tenants[tenantId].CreditsBalance.Should().Be(2);
        gateway.CapturedRequests.Should().ContainSingle(r => !r.UseTenantByok && r.Sku == "SKU-REGEN-01");
        meteringRepo.Logs.Should().ContainSingle(l => l.ProductId == "SKU-REGEN-01" && !l.IsByok && l.TotalTokens == 150);

        // Falha no gateway não-BYOK deve estornar 1 crédito automaticamente
        var failingService = new CatalogService(
            productRepo,
            tenantRepo,
            credRepo,
            new NoopSendEndpointProvider(),
            NullLogger<CatalogService>.Instance,
            new StubOpenRouterGateway(failWithFallback: true),
            new NullSeoGuidelineRepo(),
            meteringRepo);

        var act = () => failingService.RegenerateProductCopyAsync(tenantId, "SKU-REGEN-01");
        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*OpenRouter timeout*");
        tenantRepo.Tenants[tenantId].CreditsBalance.Should().Be(2);
        tenantRepo.Transactions.Should().Contain(t => t.Type == "REFUND" && t.ReferenceId == "SKU-REGEN-01");
    }

    [Fact]
    public async Task CatalogService_RegenerateProductCopyAsync_WhenByokActive_DoesNotDeductOrRefundCredits()
    {
        var tenantId = Guid.NewGuid();
        var userRepo = new InMemoryUserRepository();
        var tenantRepo = new InMemoryTenantRepository(userRepo);
        tenantRepo.Tenants[tenantId] = new Tenant { Id = tenantId, Name = "Loja BYOK", IsActive = true, CreditsBalance = 0 };

        var productRepo = new InMemoryCatalogProductRepository();
        await productRepo.AddAsync(new Product
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Sku = "SKU-BYOK-01",
            Title = "Camisa Social",
            Status = "RAW",
            Price = 120m
        });

        var service = new CatalogService(
            productRepo,
            tenantRepo,
            new StubByokCredentialRepository(hasActiveByok: true),
            new NoopSendEndpointProvider(),
            NullLogger<CatalogService>.Instance,
            new StubOpenRouterGateway(failWithFallback: true),
            new NullSeoGuidelineRepo(),
            new RecordingMeteringRepo());

        var act = () => service.RegenerateProductCopyAsync(tenantId, "SKU-BYOK-01");
        await act.Should().ThrowAsync<InvalidOperationException>();
        tenantRepo.Tenants[tenantId].CreditsBalance.Should().Be(0);
        tenantRepo.Transactions.Should().BeEmpty();
    }

    [Fact]
    public async Task SystemService_GetTelemetryMetricsAsync_ComputesRealVolumeChartCreditsAndByok_WithoutFakes()
    {
        var tenantId = Guid.NewGuid();
        var userRepo = new InMemoryUserRepository();
        var tenantRepo = new InMemoryTenantRepository(userRepo);
        tenantRepo.Tenants[tenantId] = new Tenant { Id = tenantId, Name = "Loja Real", IsActive = true, CreditsBalance = 42 };

        var mux = DispatchProxy.Create<IConnectionMultiplexer, NoopMultiplexerProxy>();

        // 1. Cenário com dados reais no SQL
        var day = DateTimeOffset.UtcNow.AddHours(-2);
        var populatedFactory = new MultiQueryTabularConnectionFactory(sql =>
        {
            if (sql.Contains("dbo.LlmUsageLogs", StringComparison.OrdinalIgnoreCase))
            {
                var dt = new DataTable();
                dt.Columns.Add("Provider", typeof(string));
                dt.Columns.Add("TotalPromptTokens", typeof(int));
                dt.Columns.Add("TotalCompletionTokens", typeof(int));
                dt.Columns.Add("TotalTokens", typeof(int));
                dt.Columns.Add("IsByok", typeof(bool));
                dt.Rows.Add("OPENROUTER", 500, 300, 800, true);
                return dt.CreateDataReader();
            }

            if (sql.Contains("dbo.Products", StringComparison.OrdinalIgnoreCase))
            {
                var dt = new DataTable();
                dt.Columns.Add("Status", typeof(string));
                dt.Columns.Add("CreatedAt", typeof(DateTimeOffset));
                dt.Rows.Add("RAW", day);
                dt.Rows.Add("PROCESSED", day);
                dt.Rows.Add("ENRICHED", day);
                return dt.CreateDataReader();
            }

            var creditDt = new DataTable();
            creditDt.Columns.Add("Total", typeof(int));
            creditDt.Rows.Add(60);
            return creditDt.CreateDataReader();
        });

        var populatedService = new SystemService(
            new FakeProductRepository(),
            new StaticLatencyActivityRepository(215),
            populatedFactory,
            mux,
            NullLogger<SystemService>.Instance,
            null,
            tenantRepo);

        var telemetry = await populatedService.GetTelemetryMetricsAsync(tenantId, "7d");

        telemetry.ProductStatus.Raw.Should().Be(1);
        telemetry.ProductStatus.Processed.Should().Be(2);
        telemetry.CreditsBalance.Should().Be(42);
        telemetry.CreditsTotal.Should().Be(60);
        telemetry.AverageLatencyMs.Should().Be(215);
        telemetry.TokenUsage.Should().ContainSingle(t => t.Provider == "OPENROUTER" && t.IsByok && t.TotalTokens == 800);
        telemetry.VolumeChart.Should().ContainSingle(v => v.RawCount == 3 && v.ProcessedCount == 2);

        // 2. Cenário vazio retorna listas vazias e zeros sem números inventados
        var emptyFactory = new MultiQueryTabularConnectionFactory(sql =>
        {
            if (sql.Contains("dbo.LlmUsageLogs", StringComparison.OrdinalIgnoreCase))
            {
                var dt = new DataTable();
                dt.Columns.Add("Provider", typeof(string));
                dt.Columns.Add("TotalPromptTokens", typeof(int));
                dt.Columns.Add("TotalCompletionTokens", typeof(int));
                dt.Columns.Add("TotalTokens", typeof(int));
                dt.Columns.Add("IsByok", typeof(bool));
                return dt.CreateDataReader();
            }

            if (sql.Contains("dbo.Products", StringComparison.OrdinalIgnoreCase))
            {
                var dt = new DataTable();
                dt.Columns.Add("Status", typeof(string));
                dt.Columns.Add("CreatedAt", typeof(DateTimeOffset));
                return dt.CreateDataReader();
            }

            var creditDt = new DataTable();
            creditDt.Columns.Add("Total", typeof(int));
            creditDt.Rows.Add(0);
            return creditDt.CreateDataReader();
        });

        tenantRepo.Tenants[tenantId].CreditsBalance = 0;
        var emptyService = new SystemService(
            new FakeProductRepository(),
            new StaticLatencyActivityRepository(0),
            emptyFactory,
            mux,
            NullLogger<SystemService>.Instance,
            null,
            tenantRepo);

        var emptyTelemetry = await emptyService.GetTelemetryMetricsAsync(tenantId, "24h");
        emptyTelemetry.ProductStatus.Raw.Should().Be(0);
        emptyTelemetry.ProductStatus.Processed.Should().Be(0);
        emptyTelemetry.VolumeChart.Should().BeEmpty();
        emptyTelemetry.TokenUsage.Should().BeEmpty();
        emptyTelemetry.CreditsBalance.Should().Be(0);
        emptyTelemetry.CreditsTotal.Should().Be(0);
    }

    [Fact]
    public async Task TenantHeaderMiddleware_ExemptsSystemDemo_AndResolvesTenantQueryOnApiStream()
    {
        var tenantId = Guid.NewGuid();
        var otherTenantId = Guid.NewGuid();
        var userRepo = new InMemoryUserRepository();
        var tenantRepo = new InMemoryTenantRepository(userRepo);
        tenantRepo.Tenants[tenantId] = new Tenant { Id = tenantId, Name = "Loja SSE", IsActive = true };

        var nextCalled = false;
        var middleware = new TenantHeaderMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        // 1. /api/v1/system/demo deve passar sem X-Tenant-ID
        var demoContext = new DefaultHttpContext();
        demoContext.Request.Path = "/api/v1/system/demo";
        await middleware.InvokeAsync(demoContext, new TenantContext(), tenantRepo);
        nextCalled.Should().BeTrue();
        demoContext.Response.StatusCode.Should().Be(StatusCodes.Status200OK);

        // 2. /api/v1/system/demo/stream deve passar sem X-Tenant-ID
        nextCalled = false;
        var demoStreamContext = new DefaultHttpContext();
        demoStreamContext.Request.Path = "/api/v1/system/demo/stream";
        await middleware.InvokeAsync(demoStreamContext, new TenantContext(), tenantRepo);
        nextCalled.Should().BeTrue();

        // 3. /api/v1/stream?tenant_id={guid} popula TenantContext quando claim confere
        nextCalled = false;
        var validSseContext = new DefaultHttpContext();
        validSseContext.Request.Path = "/api/v1/stream";
        validSseContext.Request.QueryString = new QueryString($"?tenant_id={tenantId}");
        validSseContext.User = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim("tenantId", tenantId.ToString()), new Claim(ClaimTypes.Role, "TENANT_ADMIN")],
            "Bearer"));
        var scopedTenant = new TenantContext();
        await middleware.InvokeAsync(validSseContext, scopedTenant, tenantRepo);
        nextCalled.Should().BeTrue();
        scopedTenant.TenantId.Should().Be(tenantId);

        // 4. /api/v1/stream?tenant_id={other} bloqueia cross-tenant spoofing (403 Forbidden)
        nextCalled = false;
        var spoofSseContext = new DefaultHttpContext();
        spoofSseContext.Request.Path = "/api/v1/stream";
        spoofSseContext.Request.QueryString = new QueryString($"?tenant_id={otherTenantId}");
        spoofSseContext.User = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim("tenantId", tenantId.ToString()), new Claim(ClaimTypes.Role, "TENANT_ADMIN")],
            "Bearer"));
        await middleware.InvokeAsync(spoofSseContext, new TenantContext(), tenantRepo);
        nextCalled.Should().BeFalse();
        spoofSseContext.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    private sealed class InMemoryCatalogProductRepository : IProductRepository
    {
        private readonly ConcurrentDictionary<string, Product> _products = new();

        public Task<Product?> GetBySkuAsync(Guid tenantId, string sku, CancellationToken cancellationToken = default)
        {
            _products.TryGetValue($"{tenantId}:{sku}", out var product);
            return Task.FromResult(product);
        }

        public Task<IEnumerable<Product>> GetProductsAsync(Guid tenantId, int page, int pageSize, CancellationToken cancellationToken = default)
            => Task.FromResult(_products.Values.Where(p => p.TenantId == tenantId));

        public Task<(IEnumerable<Product> Products, int TotalCount)> GetPaginatedAsync(Guid tenantId, string? statusFilter, string? search, int page, int limit, CancellationToken cancellationToken = default)
        {
            var items = _products.Values.Where(p => p.TenantId == tenantId).ToList();
            return Task.FromResult<(IEnumerable<Product>, int)>((items, items.Count));
        }

        public Task<Guid> AddAsync(Product product, CancellationToken cancellationToken = default)
        {
            _products[$"{product.TenantId}:{product.Sku}"] = product;
            return Task.FromResult(product.Id);
        }

        public Task UpdateStatusAsync(Guid tenantId, string sku, string status, string? metadata = null, CancellationToken cancellationToken = default)
        {
            if (_products.TryGetValue($"{tenantId}:{sku}", out var product))
            {
                product.Status = status;
                product.EnrichmentMetadata = metadata;
            }
            return Task.CompletedTask;
        }

        public Task UpdateAsync(Product product, CancellationToken cancellationToken = default)
        {
            _products[$"{product.TenantId}:{product.Sku}"] = product;
            return Task.CompletedTask;
        }

        public Task DeleteAsync(Guid tenantId, string sku, CancellationToken cancellationToken = default)
        {
            _products.TryRemove($"{tenantId}:{sku}", out _);
            return Task.CompletedTask;
        }
    }

    private sealed class StubByokCredentialRepository(bool hasActiveByok) : ITenantAiCredentialRepository
    {
        public Task<TenantAiCredential?> GetByProviderAsync(Guid tenantId, string provider, CancellationToken cancellationToken = default)
            => Task.FromResult<TenantAiCredential?>(null);

        public Task<bool> HasActiveByokAsync(Guid tenantId, CancellationToken cancellationToken = default)
            => Task.FromResult(hasActiveByok);

        public Task UpsertAsync(TenantAiCredential credential, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private sealed class StubOpenRouterGateway(bool failWithFallback) : IOpenRouterGateway
    {
        public List<ProductEnrichmentLlmRequest> CapturedRequests { get; } = new();

        public Task<ProductEnrichmentLlmResponse> EnrichProductAsync(ProductEnrichmentLlmRequest request, CancellationToken cancellationToken = default)
        {
            CapturedRequests.Add(request);
            if (failWithFallback)
            {
                return Task.FromResult(new ProductEnrichmentLlmResponse
                {
                    IsFallback = true,
                    ErrorMessage = "OpenRouter timeout",
                    ModelUsed = "none"
                });
            }

            return Task.FromResult(new ProductEnrichmentLlmResponse
            {
                Title = $"{request.RawTitle} Alta Performance SEO",
                Description = "Descrição otimizada por IA",
                BulletPoints = ["Leve", "Respirável"],
                SeoKeywords = ["tenis", "corrida"],
                ModelUsed = "deepseek/deepseek-chat",
                PromptTokens = 50,
                CompletionTokens = 100,
                TotalCostEstimated = 0.0005m,
                IsFallback = false
            });
        }
    }

    private sealed class RecordingMeteringRepo : IMeteringRepository
    {
        public List<LlmUsageLog> Logs { get; } = new();
        public Task<decimal> GetManagedCreditBalanceAsync(Guid tenantId, CancellationToken cancellationToken = default) => Task.FromResult(0m);
        public Task<LlmUsageLog> CreateUsageLogAsync(LlmUsageLog log, CancellationToken cancellationToken = default) { Logs.Add(log); return Task.FromResult(log); }
        public Task<bool> AtomicReserveCreditsAsync(Guid tenantId, decimal estimatedCost, CancellationToken cancellationToken = default) => Task.FromResult(true);
        public Task AtomicRefundCreditsAsync(Guid tenantId, decimal amount, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task AtomicSettleCreditsAsync(Guid tenantId, decimal reservedCost, decimal actualCost, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<(int TotalTokens, decimal TotalCost)> GetMonthlyTelemetryAsync(Guid tenantId, CancellationToken cancellationToken = default) => Task.FromResult((0, 0m));
        public Task<(IEnumerable<LlmUsageLog> Items, int TotalCount)> GetUsageLogsPaginatedAsync(Guid tenantId, int page, int limit, DateTimeOffset? startDate, DateTimeOffset? endDate, CancellationToken cancellationToken = default) => Task.FromResult((Enumerable.Empty<LlmUsageLog>(), 0));
    }

    private sealed class NullSeoGuidelineRepo : ICategorySeoGuidelinesRepository
    {
        public Task<CategorySeoGuideline?> GetGuidelineByCategoryAsync(Guid tenantId, string? categoryName, CancellationToken cancellationToken = default)
            => Task.FromResult<CategorySeoGuideline?>(null);
    }

    private sealed class NoopSendEndpointProvider : ISendEndpointProvider
    {
        public ConnectHandle ConnectSendObserver(ISendObserver observer) => throw new NotImplementedException();
        public Task<ISendEndpoint> GetSendEndpoint(Uri address) => throw new NotImplementedException();
    }

    private sealed class StaticLatencyActivityRepository(double latency) : IRobotActivityRepository
    {
        public Task<RobotActivity> CreateAsync(RobotActivity activity, CancellationToken cancellationToken = default) => Task.FromResult(activity);
        public Task<IEnumerable<RobotActivity>> GetRecentAsync(Guid tenantId, int limit, int offset, CancellationToken cancellationToken = default) => Task.FromResult(Enumerable.Empty<RobotActivity>());
        public Task<double> GetAverageLatencyAsync(Guid tenantId, TimeSpan timeframe, CancellationToken cancellationToken = default) => Task.FromResult(latency);
    }

    public class NoopMultiplexerProxy : DispatchProxy
    {
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args) => null;
    }

    private sealed class MultiQueryTabularConnectionFactory(Func<string, DbDataReader> readerFactory) : IDbConnectionFactory
    {
        public Task<IDbConnection> CreateConnectionAsync(CancellationToken cancellationToken = default) => Task.FromResult<IDbConnection>(new StubDbConnection(readerFactory));
        public Task<IDbConnection> CreateConnectionAsync(Guid? tenantId, CancellationToken cancellationToken = default) => Task.FromResult<IDbConnection>(new StubDbConnection(readerFactory));
        public Task<IDbConnection> CreateSystemConnectionAsync(CancellationToken cancellationToken = default) => Task.FromResult<IDbConnection>(new StubDbConnection(readerFactory));
    }

    private sealed class StubDbConnection(Func<string, DbDataReader> readerFactory) : DbConnection
    {
        [System.Diagnostics.CodeAnalysis.AllowNull]
        public override string ConnectionString { get; set; } = string.Empty;
        public override string Database => "Fake";
        public override string DataSource => "Fake";
        public override string ServerVersion => "1.0";
        public override ConnectionState State => ConnectionState.Open;
        public override void ChangeDatabase(string databaseName) { }
        public override void Close() { }
        public override void Open() { }
        protected override DbTransaction BeginDbTransaction(IsolationLevel isolationLevel) => throw new NotImplementedException();
        protected override DbCommand CreateDbCommand() => new StubDbCommand(readerFactory, this);
    }

    private sealed class StubDbCommand(Func<string, DbDataReader> readerFactory, DbConnection conn) : DbCommand
    {
        private readonly StubParamCollection _params = new();
        [System.Diagnostics.CodeAnalysis.AllowNull]
        public override string CommandText { get; set; } = string.Empty;
        public override int CommandTimeout { get; set; } = 30;
        public override CommandType CommandType { get; set; } = CommandType.Text;
        public override bool DesignTimeVisible { get; set; }
        public override UpdateRowSource UpdatedRowSource { get; set; }
        protected override DbConnection? DbConnection { get => conn; set { } }
        protected override DbParameterCollection DbParameterCollection => _params;
        protected override DbTransaction? DbTransaction { get; set; }
        public override void Cancel() { }
        public override int ExecuteNonQuery() => 0;
        public override object? ExecuteScalar() => null;
        public override void Prepare() { }
        protected override DbParameter CreateDbParameter() => new StubDbParameter();
        protected override DbDataReader ExecuteDbDataReader(CommandBehavior behavior) => readerFactory(CommandText);
    }

    private sealed class StubDbParameter : DbParameter
    {
        public override DbType DbType { get; set; }
        public override ParameterDirection Direction { get; set; }
        public override bool IsNullable { get; set; }
        [System.Diagnostics.CodeAnalysis.AllowNull]
        public override string ParameterName { get; set; } = string.Empty;
        public override int Size { get; set; }
        [System.Diagnostics.CodeAnalysis.AllowNull]
        public override string SourceColumn { get; set; } = string.Empty;
        public override bool SourceColumnNullMapping { get; set; }
        public override object? Value { get; set; }
        public override void ResetDbType() { }
    }

    private sealed class StubParamCollection : DbParameterCollection
    {
        private readonly List<object> _items = new();
        public override int Count => _items.Count;
        public override object SyncRoot => _items;
        public override int Add(object value) { _items.Add(value); return _items.Count - 1; }
        public override void AddRange(Array values) { foreach (var v in values) _items.Add(v); }
        public override void Clear() => _items.Clear();
        public override bool Contains(object value) => _items.Contains(value);
        public override bool Contains(string value) => false;
        public override void CopyTo(Array array, int index) => _items.ToArray().CopyTo(array, index);
        public override System.Collections.IEnumerator GetEnumerator() => _items.GetEnumerator();
        protected override DbParameter GetParameter(int index) => (DbParameter)_items[index];
        protected override DbParameter GetParameter(string parameterName) => throw new IndexOutOfRangeException();
        public override int IndexOf(object value) => _items.IndexOf(value);
        public override int IndexOf(string parameterName) => -1;
        public override void Insert(int index, object value) => _items.Insert(index, value);
        public override void Remove(object value) => _items.Remove(value);
        public override void RemoveAt(int index) => _items.RemoveAt(index);
        public override void RemoveAt(string parameterName) { }
        protected override void SetParameter(int index, DbParameter value) => _items[index] = value;
        protected override void SetParameter(string parameterName, DbParameter value) { }
    }
}
