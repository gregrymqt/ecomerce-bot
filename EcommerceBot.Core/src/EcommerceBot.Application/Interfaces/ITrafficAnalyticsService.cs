using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Analytics;

namespace EcommerceBot.Application.Interfaces;

public interface ITrafficAnalyticsService
{
    Task<Guid> RecordTenantVisitAsync(RecordTenantVisitRequestDto request, string? ipAddress, string? userAgent, CancellationToken cancellationToken = default);
    Task<TenantTrafficOverviewDto> GetTenantTrafficOverviewAsync(Guid tenantId, int days = 30, string? sourceFilter = null, CancellationToken cancellationToken = default);
    Task<VerifyTagResponseDto> VerifyStoreTagAsync(Guid tenantId, string storeUrl, CancellationToken cancellationToken = default);
}
