using System;
using System.Collections.Generic;
using System.Data;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;

namespace EcommerceBot.Infrastructure.Repositories;

public sealed class JobRepository : IJobRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public JobRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory ?? throw new ArgumentNullException(nameof(connectionFactory));
    }

    public async Task<IReadOnlyList<Job>> ClaimBatchAsync(
        string jobType,
        int batchSize,
        TimeSpan lockDuration,
        CancellationToken ct)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(jobType);
        if (batchSize <= 0) throw new ArgumentOutOfRangeException(nameof(batchSize), "Batch size must be greater than zero.");

        const string sql = """
            WITH claimed AS (
                SELECT id FROM public.jobs
                WHERE type = @JobType
                  AND status IN ('pending', 'retry')
                  AND next_run_at <= NOW()
                ORDER BY next_run_at, id
                LIMIT @BatchSize
                FOR UPDATE SKIP LOCKED
            )
            UPDATE public.jobs j
            SET status       = 'running',
                locked_until = NOW() + @LockSeconds * INTERVAL '1 second',
                attempts     = j.attempts + 1,
                updated_at   = NOW()
            FROM claimed
            WHERE j.id = claimed.id
            RETURNING 
                j.id AS Id,
                j.tenant_id AS TenantId,
                j.type AS Type,
                j.payload::text AS Payload,
                j.status AS Status,
                j.attempts AS Attempts,
                j.locked_until AS LockedUntil,
                j.next_run_at AS NextRunAt,
                j.created_at AS CreatedAt,
                j.updated_at AS UpdatedAt;
        """;

        var parameters = new
        {
            JobType = jobType,
            BatchSize = batchSize,
            LockSeconds = Math.Max(1, lockDuration.TotalSeconds)
        };

        using var conn = await _connectionFactory.CreateSystemConnectionAsync(ct);
        var jobs = await conn.QueryAsync<Job>(new CommandDefinition(sql, parameters, cancellationToken: ct));
        return jobs.AsList();
    }

    public Task AckAsync(Guid jobId, CancellationToken ct = default)
    {
        return AckAsync(jobId, null, null, ct);
    }

    public async Task AckAsync(
        Guid jobId,
        IDbConnection? conn,
        IDbTransaction? tx = null,
        CancellationToken ct = default)
    {
        if (jobId == Guid.Empty) throw new ArgumentException("JobId cannot be empty.", nameof(jobId));

        const string sql = """
            UPDATE public.jobs
            SET status = 'completed',
                locked_until = NULL,
                updated_at = NOW()
            WHERE id = @JobId;
        """;

        if (conn != null)
        {
            await conn.ExecuteAsync(new CommandDefinition(sql, new { JobId = jobId }, transaction: tx, cancellationToken: ct));
            return;
        }

        using var createdConn = await _connectionFactory.CreateSystemConnectionAsync(ct);
        await createdConn.ExecuteAsync(new CommandDefinition(sql, new { JobId = jobId }, cancellationToken: ct));
    }

    public async Task NackAsync(Guid jobId, TimeSpan retryDelay, CancellationToken ct)
    {
        if (jobId == Guid.Empty) throw new ArgumentException("JobId cannot be empty.", nameof(jobId));

        const string sql = """
            UPDATE public.jobs
            SET status = 'retry',
                next_run_at = NOW() + @DelaySeconds * INTERVAL '1 second',
                locked_until = NULL,
                updated_at = NOW()
            WHERE id = @JobId;
        """;

        var parameters = new
        {
            JobId = jobId,
            DelaySeconds = Math.Max(0, retryDelay.TotalSeconds)
        };

        using var conn = await _connectionFactory.CreateSystemConnectionAsync(ct);
        await conn.ExecuteAsync(new CommandDefinition(sql, parameters, cancellationToken: ct));
    }

    public async Task FailAsync(Guid jobId, CancellationToken ct = default)
    {
        if (jobId == Guid.Empty) throw new ArgumentException("JobId cannot be empty.", nameof(jobId));

        const string sql = """
            UPDATE public.jobs
            SET status = 'failed',
                locked_until = NULL,
                updated_at = NOW()
            WHERE id = @JobId;
        """;

        using var conn = await _connectionFactory.CreateSystemConnectionAsync(ct);
        await conn.ExecuteAsync(new CommandDefinition(sql, new { JobId = jobId }, cancellationToken: ct));
    }

    public async Task EnqueueAsync(
        Job job,
        IDbConnection? conn = null,
        IDbTransaction? tx = null,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(job);

        const string sql = """
            INSERT INTO public.jobs 
            (id, tenant_id, type, payload, status, attempts, locked_until, next_run_at, created_at, updated_at)
            VALUES 
            (@Id, @TenantId, @Type, @Payload::jsonb, @Status, @Attempts, @LockedUntil, @NextRunAt, @CreatedAt, @UpdatedAt);
        """;

        var id = job.Id == Guid.Empty ? Guid.NewGuid() : job.Id;
        var createdAt = job.CreatedAt == default ? DateTimeOffset.UtcNow : job.CreatedAt;
        var updatedAt = job.UpdatedAt == default ? DateTimeOffset.UtcNow : job.UpdatedAt;
        var nextRunAt = job.NextRunAt == default ? DateTimeOffset.UtcNow : job.NextRunAt;
        var payload = string.IsNullOrWhiteSpace(job.Payload) ? "{}" : job.Payload;
        var status = string.IsNullOrWhiteSpace(job.Status) ? "pending" : job.Status;

        var parameters = new
        {
            Id = id,
            job.TenantId,
            job.Type,
            Payload = payload,
            Status = status,
            job.Attempts,
            job.LockedUntil,
            NextRunAt = nextRunAt,
            CreatedAt = createdAt,
            UpdatedAt = updatedAt
        };

        var cmd = new CommandDefinition(sql, parameters, transaction: tx, cancellationToken: ct);

        if (conn is not null)
        {
            await conn.ExecuteAsync(cmd);
        }
        else
        {
            using var systemConn = await _connectionFactory.CreateSystemConnectionAsync(ct);
            await systemConn.ExecuteAsync(cmd);
        }
    }
}
