using System;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Domain.Interfaces;

public interface ISubscriptionRepository
{
    Task<Subscription?> GetByIdAsync(Guid id, Guid tenantId);
    Task<Subscription?> GetActiveByTenantIdAsync(Guid tenantId);
    Task<Subscription?> GetByMpPreapprovalIdAsync(string mpPreapprovalId);
    Task<Subscription> CreateAsync(Subscription subscription);
    Task UpdateAsync(Subscription subscription);
}
