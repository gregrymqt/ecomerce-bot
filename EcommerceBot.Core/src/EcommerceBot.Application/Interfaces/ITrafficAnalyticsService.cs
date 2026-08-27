using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Analytics;

namespace EcommerceBot.Application.Interfaces;

public interface ITrafficAnalyticsService
{
    Task<Guid> RecordTenantVisitAsync(RecordTenantVisitRequestDto request, string? ipAddress, string? userAgent);
    Task<TenantTrafficOverviewDto> GetTenantTrafficOverviewAsync(Guid tenantId, int days = 30, string? sourceFilter = null);
    Task<VerifyTagResponseDto> VerifyStoreTagAsync(Guid tenantId, string storeUrl);
}
