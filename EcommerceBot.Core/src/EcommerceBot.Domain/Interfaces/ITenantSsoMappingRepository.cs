using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface ITenantSsoMappingRepository
{
    Task<IEnumerable<TenantSsoMapping>> GetByTenantIdAsync(Guid tenantId);
    Task<TenantSsoMapping?> GetByIdAsync(Guid id, Guid tenantId);
    Task<TenantSsoMapping?> GetByGroupAsync(Guid tenantId, string idpGroupName);
    Task<TenantSsoMapping?> GetDefaultMappingAsync(Guid tenantId);
    Task<TenantSsoMapping> CreateAsync(TenantSsoMapping mapping);
    Task<bool> UpdateAsync(TenantSsoMapping mapping);
    Task<bool> DeleteAsync(Guid id, Guid tenantId);
}
