using System;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface ITenantConfigRepository
{
    Task<TenantConfig?> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task UpsertAsync(TenantConfig config, CancellationToken cancellationToken = default);
}
