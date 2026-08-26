using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface IRobotActivityRepository
{
    Task<RobotActivity> CreateAsync(RobotActivity activity);
    Task<IEnumerable<RobotActivity>> GetRecentAsync(Guid tenantId, int limit, int offset);
    Task<double> GetAverageLatencyAsync(Guid tenantId, TimeSpan timeframe);
}
