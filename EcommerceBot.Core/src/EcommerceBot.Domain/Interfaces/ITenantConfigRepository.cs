using System;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface ITenantConfigRepository
{
    Task<TenantConfig?> GetByTenantIdAsync(Guid tenantId);
    Task UpsertAsync(TenantConfig config);
}
