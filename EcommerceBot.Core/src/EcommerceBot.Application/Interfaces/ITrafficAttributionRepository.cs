using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Analytics;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Application.Interfaces;

public interface ITrafficAttributionRepository
{
    Task<Guid> RecordTenantVisitAsync(TrafficAttribution attribution);
    Task<TenantTrafficOverviewDto> GetTenantTrafficOverviewAsync(Guid tenantId, int days, string? sourceFilter = null);
    Task<int> LinkOrderToTrafficSessionAsync(Guid tenantId, Guid orderId, string sessionId, string? utmSource, string? utmCampaign, string? adId);
}
