using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using EcommerceBot.Infrastructure.Data;
using EcommerceBot.Infrastructure.Options;
using EcommerceBot.Infrastructure.Repositories;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Npgsql;
using Xunit;

namespace EcommerceBot.Core.Tests.Logic;

public sealed class JobRepositoryTests
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
    public async Task ClaimBatchAsync_ShouldThrow_WhenJobTypeIsInvalid()
    {
        var factory = new FakeDbConnectionFactory();
        var repo = new JobRepository(factory);

        var actNull = () => repo.ClaimBatchAsync(null!, 10, TimeSpan.FromMinutes(1), CancellationToken.None);
        var actEmpty = () => repo.ClaimBatchAsync("", 10, TimeSpan.FromMinutes(1), CancellationToken.None);
        var actBatchZero = () => repo.ClaimBatchAsync("scraping", 0, TimeSpan.FromMinutes(1), CancellationToken.None);

        await actNull.Should().ThrowAsync<ArgumentException>();
        await actEmpty.Should().ThrowAsync<ArgumentException>();
        await actBatchZero.Should().ThrowAsync<ArgumentOutOfRangeException>();
    }

    [Fact]
    public async Task AckAsync_ShouldThrow_WhenJobIdIsEmpty()
    {
        var factory = new FakeDbConnectionFactory();
        var repo = new JobRepository(factory);

        var act = () => repo.AckAsync(Guid.Empty, CancellationToken.None);
        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task NackAsync_ShouldThrow_WhenJobIdIsEmpty()
    {
        var factory = new FakeDbConnectionFactory();
        var repo = new JobRepository(factory);

        var act = () => repo.NackAsync(Guid.Empty, TimeSpan.FromSeconds(5), CancellationToken.None);
        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task EnqueueAsync_ShouldThrow_WhenJobIsNull()
    {
        var factory = new FakeDbConnectionFactory();
        var repo = new JobRepository(factory);

        var act = () => repo.EnqueueAsync(null!, ct: CancellationToken.None);
        await act.Should().ThrowAsync<ArgumentNullException>();
    }

    [Fact]
    public async Task PostgresIntegration_FullQueueLifecycle_WorksCorrectly()
    {
        if (!IsPostgresAvailable())
        {
            return; // Skip if local docker postgres is not running
        }

        var factory = new DbConnectionFactory(
            Options.Create(new DatabaseOptions
            {
                DefaultConnection = GetDevConnectionString()
            }),
            httpContextAccessor: null
        );

        var repo = new JobRepository(factory);
        var tenantId = Guid.NewGuid();
        var jobType = "test_lifecycle_" + Guid.NewGuid().ToString("N")[..8];

        var job = new Job
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Type = jobType,
            Payload = "{\"test\":true}",
            Status = "pending",
            NextRunAt = DateTimeOffset.UtcNow.AddSeconds(-1)
        };

        // 1. Enqueue
        await repo.EnqueueAsync(job, ct: CancellationToken.None);

        // 2. Claim
        var claimed = await repo.ClaimBatchAsync(jobType, 10, TimeSpan.FromSeconds(30), CancellationToken.None);
        claimed.Should().HaveCount(1);
        claimed[0].Id.Should().Be(job.Id);
        claimed[0].TenantId.Should().Be(tenantId);
        claimed[0].Status.Should().Be("running");
        claimed[0].Attempts.Should().Be(1);
        claimed[0].LockedUntil.Should().NotBeNull();

        // 3. Nack with delay
        await repo.NackAsync(job.Id, TimeSpan.FromSeconds(60), CancellationToken.None);
        var claimedAfterNack = await repo.ClaimBatchAsync(jobType, 10, TimeSpan.FromSeconds(30), CancellationToken.None);
        claimedAfterNack.Should().BeEmpty(); // Since next_run_at is in the future

        // 4. Ack
        await repo.AckAsync(job.Id, CancellationToken.None);
    }

    private sealed class FakeDbConnectionFactory : IDbConnectionFactory
    {
        public Task<System.Data.IDbConnection> CreateConnectionAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<System.Data.IDbConnection> CreateConnectionAsync(Guid? tenantId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<System.Data.IDbConnection> CreateSystemConnectionAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
    }
}
