using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface IRobotActivityRepository
{
    Task<RobotActivity> CreateAsync(RobotActivity activity, CancellationToken cancellationToken = default);
    Task<IEnumerable<RobotActivity>> GetRecentAsync(Guid tenantId, int limit, int offset, CancellationToken cancellationToken = default);
    Task<double> GetAverageLatencyAsync(Guid tenantId, TimeSpan timeframe, CancellationToken cancellationToken = default);
}
