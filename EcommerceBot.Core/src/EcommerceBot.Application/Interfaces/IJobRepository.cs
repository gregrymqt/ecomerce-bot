using System;
using System.Collections.Generic;
using System.Data;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Application.Interfaces;

public interface IJobRepository
{
    Task<IReadOnlyList<Job>> ClaimBatchAsync(string jobType, int batchSize, TimeSpan lockDuration, CancellationToken ct);
    Task AckAsync(Guid jobId, CancellationToken ct = default);
    Task AckAsync(Guid jobId, IDbConnection? conn, IDbTransaction? tx = null, CancellationToken ct = default);
    Task NackAsync(Guid jobId, TimeSpan retryDelay, CancellationToken ct);
    Task FailAsync(Guid jobId, CancellationToken ct = default);
    Task EnqueueAsync(Job job, IDbConnection? conn = null, IDbTransaction? tx = null, CancellationToken ct = default);
}
