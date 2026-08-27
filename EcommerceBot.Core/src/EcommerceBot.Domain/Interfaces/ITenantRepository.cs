using System;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface ITenantRepository
{
    Task<Tenant?> GetByIdAsync(Guid tenantId);
    Task<Tenant?> GetBySlugAsync(string slug);
    Task<bool> HasCreditsAsync(Guid tenantId, int requiredCredits = 1);
    Task DeductCreditsAsync(Guid tenantId, int amount);
    Task AddCreditsAsync(Guid tenantId, int amount);
    Task AddManagedBalanceAsync(Guid tenantId, decimal amount);
}
