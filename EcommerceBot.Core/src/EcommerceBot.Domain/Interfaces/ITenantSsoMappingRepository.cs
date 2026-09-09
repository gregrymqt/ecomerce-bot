using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface ITenantSsoMappingRepository
{
    Task<IEnumerable<TenantSsoMapping>> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<TenantSsoMapping?> GetByIdAsync(Guid id, Guid tenantId, CancellationToken cancellationToken = default);
    Task<TenantSsoMapping?> GetByGroupAsync(Guid tenantId, string idpGroupName, CancellationToken cancellationToken = default);
    Task<TenantSsoMapping?> GetDefaultMappingAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<TenantSsoMapping> CreateAsync(TenantSsoMapping mapping, CancellationToken cancellationToken = default);
    Task<bool> UpdateAsync(TenantSsoMapping mapping, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, Guid tenantId, CancellationToken cancellationToken = default);
}
