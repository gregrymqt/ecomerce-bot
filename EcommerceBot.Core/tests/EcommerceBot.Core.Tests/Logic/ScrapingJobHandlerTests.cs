namespace EcommerceBot.Core.Tests.Logic;

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Application.DTOs.Messaging;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Data;
using EcommerceBot.Infrastructure.Jobs;
using EcommerceBot.Infrastructure.Options;
using EcommerceBot.Infrastructure.Repositories;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Npgsql;
using Xunit;

public sealed class ScrapingJobHandlerTests
{
    private static string GetDevConnectionString() =>
        Environment.GetEnvironmentVariable("TEST_POSTGRES_CONNECTION_STRING") ??
        new NpgsqlConnectionStringBuilder
        {
            Host = "127.0.0.1",
            Port = 5432,
            Database = "ecommerce_bot_db",
            Username = "postgres",
            Password = Environment.GetEnvironmentVariable("DEV_POSTGRES_PWD") ?? "postgres"
        }.ConnectionString;

    private static bool IsPostgresAvailable()
    {
        try
        {
            using var conn = new NpgsqlConnection(GetDevConnectionString());
            conn.Open();
            return true;
        }
        catch
        {
            return false;
        }
    }

    [Fact]
    public async Task HandleAsync_WhenScrapingSucceeds_CommitsAckAndEnqueuesSeoEnrichmentJob()
    {
        var tenantId = Guid.NewGuid();
        var jobId = Guid.NewGuid();

        var requestPayload = new ScrapingRequestMessage
        {
            TenantId = tenantId,
            Sku = "SKU-TEST-01",
            Url = "https://example.com/product/1",
            PromptContext = "foco em esportes",
            IsByok = false
        };

        var initialJob = new Job
        {
            Id = jobId,
            TenantId = tenantId,
            Type = "scraping",
            Payload = JsonSerializer.Serialize(requestPayload),
            Status = "running",
            Attempts = 1
        };

        var expectedScrapedResult = new ScrapedRawProductEvent
        {
            TenantId = tenantId,
            Sku = "SKU-TEST-01",
            Url = "https://example.com/product/1",
            RawTitle = "Camisa Esportiva DryFit",
            RawDescriptionHtml = "<p>Camisa leve para corrida</p>",
            RawMarkdown = "Camisa leve para corrida",
            Price = 119.90m,
            Currency = "BRL",
            Success = true
        };

        var fakeScraper = new FakeProductScraper(expectedScrapedResult);
        var fakeRepo = new FakeJobRepository();
        var fakeConnFactory = new FakeDbConnectionFactory();

        var handler = new ScrapingJobHandler(
            fakeScraper,
            fakeRepo,
            fakeConnFactory,
            NullLogger<ScrapingJobHandler>.Instance);

        await handler.HandleAsync(initialJob, CancellationToken.None);

        fakeRepo.AckedJobIds.Should().Contain(jobId);
        fakeRepo.EnqueuedJobs.Should().ContainSingle();

        var seoJob = fakeRepo.EnqueuedJobs.First();
        seoJob.Type.Should().Be("seo_enrichment");
        seoJob.TenantId.Should().Be(tenantId);
        seoJob.Status.Should().Be("pending");

        var deserializedSeoPayload = JsonSerializer.Deserialize<ScrapedRawProductEvent>(
            seoJob.Payload,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        deserializedSeoPayload.Should().NotBeNull();
        deserializedSeoPayload!.RawTitle.Should().Be("Camisa Esportiva DryFit");
        deserializedSeoPayload.Price.Should().Be(119.90m);
    }

    [Fact]
    public async Task HandleAsync_WhenScraperFails_ThrowsExceptionAndDoesNotCommit()
    {
        var tenantId = Guid.NewGuid();
        var jobId = Guid.NewGuid();

        var requestPayload = new ScrapingRequestMessage
        {
            TenantId = tenantId,
            Sku = "FAIL-01",
            Url = "https://example.com/unavailable",
            IsByok = false
        };

        var initialJob = new Job
        {
            Id = jobId,
            TenantId = tenantId,
            Type = "scraping",
            Payload = JsonSerializer.Serialize(requestPayload),
            Status = "running",
            Attempts = 1
        };

        var failedResult = new ScrapedRawProductEvent
        {
            TenantId = tenantId,
            Sku = "FAIL-01",
            Url = "https://example.com/unavailable",
            Success = false,
            ErrorMessage = "Target server blocked request (403 Forbidden)"
        };

        var fakeScraper = new FakeProductScraper(failedResult);
        var fakeRepo = new FakeJobRepository();
        var fakeConnFactory = new FakeDbConnectionFactory();

        var handler = new ScrapingJobHandler(
            fakeScraper,
            fakeRepo,
            fakeConnFactory,
            NullLogger<ScrapingJobHandler>.Instance);

        var act = () => handler.HandleAsync(initialJob, CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Scraping failed*");

        fakeRepo.AckedJobIds.Should().BeEmpty();
        fakeRepo.EnqueuedJobs.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_WhenPayloadIsInvalid_ThrowsException()
    {
        var initialJob = new Job
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            Type = "scraping",
            Payload = "{ corrupt json invalid payload",
            Status = "running"
        };

        var fakeScraper = new FakeProductScraper(new ScrapedRawProductEvent { Success = true });
        var fakeRepo = new FakeJobRepository();
        var fakeConnFactory = new FakeDbConnectionFactory();

        var handler = new ScrapingJobHandler(
            fakeScraper,
            fakeRepo,
            fakeConnFactory,
            NullLogger<ScrapingJobHandler>.Instance);

        var act = () => handler.HandleAsync(initialJob, CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>();
        fakeRepo.AckedJobIds.Should().BeEmpty();
        fakeRepo.EnqueuedJobs.Should().BeEmpty();
    }

    [Fact]
    public async Task PostgresIntegration_ScrapingJobHandler_ExecutesTransactionEndToEnd()
    {
        if (!IsPostgresAvailable())
        {
            return;
        }

        var factory = new DbConnectionFactory(
            Options.Create(new DatabaseOptions { DefaultConnection = GetDevConnectionString() }),
            httpContextAccessor: null);

        var repo = new JobRepository(factory);
        var tenantId = Guid.NewGuid();
        var scrapingJobId = Guid.NewGuid();

        var requestPayload = new ScrapingRequestMessage
        {
            TenantId = tenantId,
            Sku = "POSTGRES-E2E-01",
            Url = "https://example.com/e2e-product",
            PromptContext = "teste de transação E2E",
            IsByok = false
        };

        var initialJob = new Job
        {
            Id = scrapingJobId,
            TenantId = tenantId,
            Type = "scraping",
            Payload = JsonSerializer.Serialize(requestPayload),
            Status = "pending",
            Attempts = 0,
            NextRunAt = DateTimeOffset.UtcNow.AddSeconds(-1)
        };

        await repo.EnqueueAsync(initialJob, ct: CancellationToken.None);

        // Claim do job
        var claimed = await repo.ClaimBatchAsync("scraping", 1, TimeSpan.FromMinutes(1), CancellationToken.None);
        var jobToProcess = claimed.First(j => j.Id == scrapingJobId);

        var expectedScrapedResult = new ScrapedRawProductEvent
        {
            TenantId = tenantId,
            Sku = "POSTGRES-E2E-01",
            Url = "https://example.com/e2e-product",
            RawTitle = "Notebook Gamer Pro 16GB",
            Price = 4599.00m,
            Currency = "BRL",
            Success = true
        };

        var fakeScraper = new FakeProductScraper(expectedScrapedResult);
        var handler = new ScrapingJobHandler(fakeScraper, repo, factory, NullLogger<ScrapingJobHandler>.Instance);

        await handler.HandleAsync(jobToProcess, CancellationToken.None);

        // Verificações no PostgreSQL real
        using var conn = await factory.CreateSystemConnectionAsync(CancellationToken.None);

        var originalJobStatus = await conn.QuerySingleOrDefaultAsync<string>(
            "SELECT status FROM public.jobs WHERE id = @Id", new { Id = scrapingJobId });
        originalJobStatus.Should().Be("completed");

        var nextJob = await conn.QuerySingleOrDefaultAsync<Job>(
            "SELECT id, tenant_id as TenantId, type, status, payload FROM public.jobs WHERE tenant_id = @TenantId AND type = 'seo_enrichment'",
            new { TenantId = tenantId });

        nextJob.Should().NotBeNull();
        nextJob!.Status.Should().Be("pending");
        nextJob.Payload.Should().Contain("Notebook Gamer Pro 16GB");
    }

    #region Fakes

    private sealed class FakeProductScraper : IProductScraper
    {
        private readonly ScrapedRawProductEvent _response;

        public FakeProductScraper(ScrapedRawProductEvent response)
        {
            _response = response;
        }

        public Task<ScrapedRawProductEvent> ScrapeAsync(ScrapingRequestMessage request, CancellationToken ct)
        {
            return Task.FromResult(_response);
        }
    }

    private sealed class FakeJobRepository : IJobRepository
    {
        public ConcurrentBag<Guid> AckedJobIds { get; } = new();
        public ConcurrentBag<Job> EnqueuedJobs { get; } = new();

        public Task<IReadOnlyList<Job>> ClaimBatchAsync(string jobType, int batchSize, TimeSpan lockDuration, CancellationToken ct)
        {
            return Task.FromResult<IReadOnlyList<Job>>(Array.Empty<Job>());
        }

        public Task AckAsync(Guid jobId, CancellationToken ct = default)
        {
            AckedJobIds.Add(jobId);
            return Task.CompletedTask;
        }

        public Task AckAsync(Guid jobId, IDbConnection? conn, IDbTransaction? tx = null, CancellationToken ct = default)
        {
            AckedJobIds.Add(jobId);
            return Task.CompletedTask;
        }

        public Task NackAsync(Guid jobId, TimeSpan retryDelay, CancellationToken ct) => Task.CompletedTask;
        public Task FailAsync(Guid jobId, CancellationToken ct = default) => Task.CompletedTask;

        public Task EnqueueAsync(Job job, IDbConnection? conn = null, IDbTransaction? tx = null, CancellationToken ct = default)
        {
            EnqueuedJobs.Add(job);
            return Task.CompletedTask;
        }
    }

    private sealed class FakeDbConnectionFactory : IDbConnectionFactory
    {
        public Task<IDbConnection> CreateConnectionAsync(CancellationToken ct = default)
        {
            return Task.FromResult<IDbConnection>(new FakeDbConnection());
        }

        public Task<IDbConnection> CreateConnectionAsync(Guid? tenantId, CancellationToken ct = default)
        {
            return Task.FromResult<IDbConnection>(new FakeDbConnection());
        }

        public Task<IDbConnection> CreateSystemConnectionAsync(CancellationToken ct = default)
        {
            return Task.FromResult<IDbConnection>(new FakeDbConnection());
        }
    }

    private sealed class FakeDbConnection : IDbConnection
    {
#pragma warning disable CS8767, CS8766
        public string ConnectionString { get; set; } = string.Empty;
#pragma warning restore CS8767, CS8766
        public int ConnectionTimeout => 30;
        public string Database => "fake";
        public ConnectionState State => ConnectionState.Open;

        public IDbTransaction BeginTransaction() => new FakeDbTransaction(this);
        public IDbTransaction BeginTransaction(IsolationLevel il) => new FakeDbTransaction(this);
        public void ChangeDatabase(string databaseName) { }
        public void Close() { }
        public IDbCommand CreateCommand() => throw new NotImplementedException();
        public void Open() { }
        public void Dispose() { }
    }

    private sealed class FakeDbTransaction : IDbTransaction
    {
        public FakeDbTransaction(IDbConnection connection) => Connection = connection;
        public IDbConnection Connection { get; }
        public IsolationLevel IsolationLevel => IsolationLevel.ReadCommitted;
        public void Commit() { }
        public void Rollback() { }
        public void Dispose() { }
    }

    #endregion
}
