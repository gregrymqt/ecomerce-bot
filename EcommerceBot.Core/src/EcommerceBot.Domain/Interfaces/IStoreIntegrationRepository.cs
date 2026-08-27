using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface IStoreIntegrationRepository
{
    Task<StoreIntegration?> GetByIdAsync(Guid id);
    Task<StoreIntegration?> GetByTenantAndPlatformAsync(Guid tenantId, string platform);
    Task<StoreIntegration?> GetByDomainAsync(string platform, string storeDomain);
    Task<IEnumerable<StoreIntegration>> ListByTenantAsync(Guid tenantId);
    Task<int> CountByTenantAsync(Guid tenantId);
    Task UpsertAsync(StoreIntegration integration);
    Task<bool> DeleteAsync(Guid tenantId, Guid id);
    Task UpdateHealthCheckAsync(Guid id, string status, int latencyMs, string healthMessage);
}
