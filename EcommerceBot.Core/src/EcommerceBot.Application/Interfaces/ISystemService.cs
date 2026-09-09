using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.System;

namespace EcommerceBot.Application.Interfaces;

public interface ISystemService
{
    Task<DashboardTelemetryResponse> GetTelemetryMetricsAsync(Guid tenantId, string timeframe, CancellationToken cancellationToken = default);
    Task<IEnumerable<RobotActivityDto>> GetRecentActivitiesAsync(Guid tenantId, int limit, int page, CancellationToken cancellationToken = default);
    Task<SystemHealthResponse> CheckSystemHealthAsync(CancellationToken cancellationToken = default);
    Task ProcessDemoRequestAsync(List<string> urls, CancellationToken cancellationToken = default);
    Task ExportDataToStreamAsync(Guid tenantId, string platform, StreamWriter writer, CancellationToken cancellationToken = default);
}
