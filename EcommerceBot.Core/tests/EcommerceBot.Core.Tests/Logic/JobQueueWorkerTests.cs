namespace EcommerceBot.Core.Tests.Logic;

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Data;
using EcommerceBot.Infrastructure.Jobs;
using EcommerceBot.Infrastructure.Options;
using EcommerceBot.Infrastructure.Repositories;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Npgsql;
using Xunit;

public sealed class JobQueueWorkerTests
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
    public async Task JobQueueWorker_ShouldDispatchJobToMatchingHandler_AndAckJob()
    {
        var services = new ServiceCollection();
        var fakeRepo = new InMemoryJobRepository();
        var handlerSignal = new TaskCompletionSource<Job>(TaskCreationOptions.RunContinuationsAsynchronously);
        var testHandler = new TestJobHandler("scraping", handlerSignal);

        var testJob = new Job
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            Type = "scraping",
            Payload = "{\"url\":\"https://example.com\"}",
            Status = "pending",
            Attempts = 0
        };
        fakeRepo.ClaimableJobs.Enqueue(testJob);

        services.AddSingleton<IJobRepository>(fakeRepo);
        services.AddSingleton<IJobHandler>(testHandler);

        var options = Options.Create(new JobQueueOptions
        {
            ChannelCapacity = 10,
            Concurrency = 1,
            BatchSize = 5,
            PrefetchThreshold = 5,
            PollIntervalMs = 50,
            LockDurationSeconds = 60,
            MaxRetries = 3
        });

        var sp = services.BuildServiceProvider();
        var scopeFactory = sp.GetRequiredService<IServiceScopeFactory>();
        var worker = new JobQueueWorker(scopeFactory, options, NullLogger<JobQueueWorker>.Instance);

        using var cts = new CancellationTokenSource();
        var workerTask = worker.StartAsync(cts.Token);

        var completedJob = await Task.WhenAny(handlerSignal.Task, Task.Delay(3000));
        completedJob.Should().Be(handlerSignal.Task, "Handler should have been invoked within timeout");

        await cts.CancelAsync();
        await worker.StopAsync(CancellationToken.None);

        testHandler.HandledJobs.Should().ContainSingle(j => j.Id == testJob.Id);
        fakeRepo.AckedJobIds.Should().Contain(testJob.Id);
        fakeRepo.NackedJobs.Should().BeEmpty();
        fakeRepo.FailedJobIds.Should().BeEmpty();
    }

    [Fact]
    public async Task JobQueueWorker_WhenHandlerThrows_ShouldNackWithRetryDelay()
    {
        var services = new ServiceCollection();
        var fakeRepo = new InMemoryJobRepository();
        var failureSignal = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var failingHandler = new TestJobHandler("scraping", onHandled: () =>
        {
            failureSignal.TrySetResult(true);
            throw new InvalidOperationException("Scraping service unreachable");
        });

        var testJob = new Job
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            Type = "scraping",
            Payload = "{}",
            Status = "pending",
            Attempts = 0
        };
        fakeRepo.ClaimableJobs.Enqueue(testJob);

        services.AddSingleton<IJobRepository>(fakeRepo);
        services.AddSingleton<IJobHandler>(failingHandler);

        var options = Options.Create(new JobQueueOptions
        {
            ChannelCapacity = 10,
            Concurrency = 1,
            BatchSize = 5,
            PrefetchThreshold = 5,
            PollIntervalMs = 50,
            LockDurationSeconds = 60,
            MaxRetries = 5
        });

        var sp = services.BuildServiceProvider();
        var scopeFactory = sp.GetRequiredService<IServiceScopeFactory>();
        var worker = new JobQueueWorker(scopeFactory, options, NullLogger<JobQueueWorker>.Instance);

        using var cts = new CancellationTokenSource();
        await worker.StartAsync(cts.Token);

        await Task.WhenAny(failureSignal.Task, Task.Delay(3000));

        // Aguarda breve intervalo para o Nack ser processado
        await Task.Delay(100);

        await cts.CancelAsync();
        await worker.StopAsync(CancellationToken.None);

        fakeRepo.NackedJobs.Should().ContainKey(testJob.Id);
        fakeRepo.AckedJobIds.Should().BeEmpty();
        fakeRepo.FailedJobIds.Should().BeEmpty();
    }

    [Fact]
    public async Task JobQueueWorker_WhenAttemptsExceedMaxRetries_ShouldCallFail()
    {
        var services = new ServiceCollection();
        var fakeRepo = new InMemoryJobRepository();
        var failureSignal = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var failingHandler = new TestJobHandler("failing_type", onHandled: () =>
        {
            failureSignal.TrySetResult(true);
            throw new InvalidOperationException("Permanent fatal failure");
        });

        var testJob = new Job
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            Type = "failing_type",
            Payload = "{}",
            Status = "retry",
            Attempts = 4 // No claim vai para 5
        };
        fakeRepo.ClaimableJobs.Enqueue(testJob);

        services.AddSingleton<IJobRepository>(fakeRepo);
        services.AddSingleton<IJobHandler>(failingHandler);

        var options = Options.Create(new JobQueueOptions
        {
            ChannelCapacity = 10,
            Concurrency = 1,
            BatchSize = 5,
            PrefetchThreshold = 5,
            PollIntervalMs = 50,
            LockDurationSeconds = 60,
            MaxRetries = 5 // Limite atingido
        });

        var sp = services.BuildServiceProvider();
        var scopeFactory = sp.GetRequiredService<IServiceScopeFactory>();
        var worker = new JobQueueWorker(scopeFactory, options, NullLogger<JobQueueWorker>.Instance);

        using var cts = new CancellationTokenSource();
        await worker.StartAsync(cts.Token);

        await Task.WhenAny(failureSignal.Task, Task.Delay(3000));
        await Task.Delay(100);

        await cts.CancelAsync();
        await worker.StopAsync(CancellationToken.None);

        fakeRepo.FailedJobIds.Should().Contain(testJob.Id);
        fakeRepo.AckedJobIds.Should().BeEmpty();
    }

    [Fact]
    public async Task JobQueueWorker_WhenNoHandlerRegisteredForType_ShouldMarkAsFailed()
    {
        var services = new ServiceCollection();
        var fakeRepo = new InMemoryJobRepository();
        var dummyHandler = new TestJobHandler("known_type");

        var testJob = new Job
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            Type = "unsupported_type",
            Payload = "{}",
            Status = "pending",
            Attempts = 0
        };

        // Força a inserção simulando que outro jobType foi reivindicado
        fakeRepo.OverrideClaimJobs.Enqueue(testJob);

        services.AddSingleton<IJobRepository>(fakeRepo);
        services.AddSingleton<IJobHandler>(dummyHandler);

        var options = Options.Create(new JobQueueOptions
        {
            ChannelCapacity = 10,
            Concurrency = 1,
            BatchSize = 5,
            PrefetchThreshold = 5,
            PollIntervalMs = 50,
            LockDurationSeconds = 60,
            MaxRetries = 3
        });

        var sp = services.BuildServiceProvider();
        var scopeFactory = sp.GetRequiredService<IServiceScopeFactory>();
        var worker = new JobQueueWorker(scopeFactory, options, NullLogger<JobQueueWorker>.Instance);

        using var cts = new CancellationTokenSource();
        await worker.StartAsync(cts.Token);

        await Task.Delay(300);

        await cts.CancelAsync();
        await worker.StopAsync(CancellationToken.None);

        fakeRepo.FailedJobIds.Should().Contain(testJob.Id);
    }

    [Fact]
    public async Task PostgresIntegration_JobQueueWorker_ExecutesEndToEnd()
    {
        if (!IsPostgresAvailable())
        {
            return; // Executa somente com container PostgreSQL local ativo
        }

        var factory = new DbConnectionFactory(
            Options.Create(new DatabaseOptions { DefaultConnection = GetDevConnectionString() }),
            httpContextAccessor: null);

        var repo = new JobRepository(factory);
        var testJobType = $"integration_{Guid.NewGuid():N}";
        var jobId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();

        var job = new Job
        {
            Id = jobId,
            TenantId = tenantId,
            Type = testJobType,
            Payload = "{\"test\":\"integration_payload\"}",
            Status = "pending",
            Attempts = 0,
            NextRunAt = DateTimeOffset.UtcNow.AddSeconds(-1)
        };

        await repo.EnqueueAsync(job, ct: CancellationToken.None);

        var handlerSignal = new TaskCompletionSource<Job>(TaskCreationOptions.RunContinuationsAsynchronously);
        var integrationHandler = new TestJobHandler(testJobType, handlerSignal);

        var services = new ServiceCollection();
        services.AddSingleton<IDbConnectionFactory>(factory);
        services.AddScoped<IJobRepository, JobRepository>();
        services.AddSingleton<IJobHandler>(integrationHandler);

        var options = Options.Create(new JobQueueOptions
        {
            ChannelCapacity = 10,
            Concurrency = 1,
            BatchSize = 10,
            PrefetchThreshold = 5,
            PollIntervalMs = 50,
            LockDurationSeconds = 30,
            MaxRetries = 3
        });

        var sp = services.BuildServiceProvider();
        var scopeFactory = sp.GetRequiredService<IServiceScopeFactory>();
        var worker = new JobQueueWorker(scopeFactory, options, NullLogger<JobQueueWorker>.Instance);

        using var cts = new CancellationTokenSource();
        await worker.StartAsync(cts.Token);

        var completedTask = await Task.WhenAny(handlerSignal.Task, Task.Delay(4000));
        completedTask.Should().Be(handlerSignal.Task, "Postgres integration handler should be called");

        // Breve intervalo para o AckAsync persistir a conclusão
        await Task.Delay(150);

        await cts.CancelAsync();
        await worker.StopAsync(CancellationToken.None);

        using var conn = await factory.CreateSystemConnectionAsync(CancellationToken.None);
        var dbStatus = await conn.QuerySingleOrDefaultAsync<string>(
            "SELECT status FROM public.jobs WHERE id = @Id", new { Id = jobId });

        dbStatus.Should().Be("completed");
    }

    #region Fakes de Teste

    private sealed class TestJobHandler : IJobHandler
    {
        private readonly TaskCompletionSource<Job>? _signal;
        private readonly Action? _onHandled;

        public string JobType { get; }
        public ConcurrentBag<Job> HandledJobs { get; } = new();

        public TestJobHandler(string jobType, TaskCompletionSource<Job>? signal = null, Action? onHandled = null)
        {
            JobType = jobType;
            _signal = signal;
            _onHandled = onHandled;
        }

        public Task HandleAsync(Job job, CancellationToken ct)
        {
            HandledJobs.Add(job);
            _signal?.TrySetResult(job);
            _onHandled?.Invoke();
            return Task.CompletedTask;
        }
    }

    private sealed class InMemoryJobRepository : IJobRepository
    {
        public ConcurrentQueue<Job> ClaimableJobs { get; } = new();
        public ConcurrentQueue<Job> OverrideClaimJobs { get; } = new();
        public ConcurrentBag<Guid> AckedJobIds { get; } = new();
        public ConcurrentDictionary<Guid, TimeSpan> NackedJobs { get; } = new();
        public ConcurrentBag<Guid> FailedJobIds { get; } = new();

        public Task<IReadOnlyList<Job>> ClaimBatchAsync(string jobType, int batchSize, TimeSpan lockDuration, CancellationToken ct)
        {
            var list = new List<Job>();

            while (OverrideClaimJobs.TryDequeue(out var overrideJob))
            {
                overrideJob.Attempts++;
                list.Add(overrideJob);
                if (list.Count >= batchSize) break;
            }

            while (ClaimableJobs.TryDequeue(out var job))
            {
                if (string.Equals(job.Type, jobType, StringComparison.OrdinalIgnoreCase))
                {
                    job.Attempts++;
                    list.Add(job);
                    if (list.Count >= batchSize) break;
                }
            }

            return Task.FromResult<IReadOnlyList<Job>>(list);
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

        public Task NackAsync(Guid jobId, TimeSpan retryDelay, CancellationToken ct)
        {
            NackedJobs[jobId] = retryDelay;
            return Task.CompletedTask;
        }

        public Task FailAsync(Guid jobId, CancellationToken ct = default)
        {
            FailedJobIds.Add(jobId);
            return Task.CompletedTask;
        }

        public Task EnqueueAsync(Job job, IDbConnection? conn = null, IDbTransaction? tx = null, CancellationToken ct = default)
        {
            ClaimableJobs.Enqueue(job);
            return Task.CompletedTask;
        }
    }

    #endregion
}
