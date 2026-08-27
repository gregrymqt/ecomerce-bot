using System;
using System.Threading.Tasks;
using EcommerceBot.Domain.Entities;

namespace EcommerceBot.Application.Interfaces;

public interface ISubscriptionService
{
    Task<Subscription?> GetActiveSubscriptionAsync(Guid tenantId);
    Task<Subscription> ActivateOrRenewSubscriptionAsync(Guid tenantId, Guid planId, string? mpPreapprovalId = null, string? mpPayerId = null);
    Task CancelSubscriptionAsync(Guid tenantId);
}
