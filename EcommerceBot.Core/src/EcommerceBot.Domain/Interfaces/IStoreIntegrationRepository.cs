using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface IStoreIntegrationRepository
{
    Task<StoreIntegration?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<StoreIntegration?> GetByTenantAndPlatformAsync(Guid tenantId, string platform, CancellationToken cancellationToken = default);
    Task<StoreIntegration?> GetByDomainAsync(string platform, string storeDomain, CancellationToken cancellationToken = default);
    Task<IEnumerable<StoreIntegration>> ListByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<int> CountByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task UpsertAsync(StoreIntegration integration, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid tenantId, Guid id, CancellationToken cancellationToken = default);
    Task UpdateHealthCheckAsync(Guid id, string status, int latencyMs, string healthMessage, CancellationToken cancellationToken = default);
    Task UpdateStatusAsync(Guid tenantId, string platform, string status, CancellationToken cancellationToken = default);
}
