using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.System;

namespace EcommerceBot.Application.Interfaces;

public interface ISystemService
{
    Task<DashboardTelemetryResponse> GetTelemetryMetricsAsync(Guid tenantId, string timeframe);
    Task<IEnumerable<RobotActivityDto>> GetRecentActivitiesAsync(Guid tenantId, int limit, int page);
    Task<SystemHealthResponse> CheckSystemHealthAsync();
    Task ProcessDemoRequestAsync(List<string> urls);
    Task ExportDataToStreamAsync(Guid tenantId, string platform, StreamWriter writer);
}
