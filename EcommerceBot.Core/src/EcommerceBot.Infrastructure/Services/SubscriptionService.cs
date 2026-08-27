using System;
using System.Threading.Tasks;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public class SubscriptionService : ISubscriptionService
{
    private readonly ISubscriptionRepository _subscriptionRepository;
    private readonly IPlanRepository _planRepository;
    private readonly ITenantRepository _tenantRepository;
    private readonly ILogger<SubscriptionService> _logger;

    public SubscriptionService(
        ISubscriptionRepository subscriptionRepository,
        IPlanRepository planRepository,
        ITenantRepository tenantRepository,
        ILogger<SubscriptionService> logger)
    {
        _subscriptionRepository = subscriptionRepository;
        _planRepository = planRepository;
        _tenantRepository = tenantRepository;
        _logger = logger;
    }

    public async Task<Subscription?> GetActiveSubscriptionAsync(Guid tenantId)
    {
        return await _subscriptionRepository.GetActiveByTenantIdAsync(tenantId);
    }

    public async Task<Subscription> ActivateOrRenewSubscriptionAsync(
        Guid tenantId, 
        Guid planId, 
        string? mpPreapprovalId = null, 
        string? mpPayerId = null)
    {
        var plan = await _planRepository.GetByIdAsync(planId);
        if (plan == null)
        {
            throw new ArgumentException($"Plano com ID {planId} não encontrado.");
        }

        var existing = await _subscriptionRepository.GetActiveByTenantIdAsync(tenantId);
        var now = DateTimeOffset.UtcNow;
        var durationDays = plan.BillingInterval.ToUpper() == "YEARLY" ? 365 : 30;

        if (existing != null)
        {
            _logger.LogInformation("Renewing existing subscription {SubId} for tenant {TenantId}", existing.Id, tenantId);
            
            existing.PlanId = planId;
            existing.Status = "authorized";
            existing.CurrentPeriodStart = now;
            existing.CurrentPeriodEnd = (existing.CurrentPeriodEnd.HasValue && existing.CurrentPeriodEnd.Value > now)
                ? existing.CurrentPeriodEnd.Value.AddDays(durationDays)
                : now.AddDays(durationDays);

            if (!string.IsNullOrEmpty(mpPreapprovalId)) existing.MpPreapprovalId = mpPreapprovalId;
            if (!string.IsNullOrEmpty(mpPayerId)) existing.MpPayerId = mpPayerId;

            await _subscriptionRepository.UpdateAsync(existing);
            await _tenantRepository.AddCreditsAsync(tenantId, plan.CreditsIncluded);
            return existing;
        }

        _logger.LogInformation("Creating new subscription for tenant {TenantId} on plan {PlanId}", tenantId, planId);
        var newSubscription = new Subscription
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PlanId = planId,
            MpPreapprovalId = mpPreapprovalId,
            MpPayerId = mpPayerId,
            Status = "authorized",
            CurrentPeriodStart = now,
            CurrentPeriodEnd = now.AddDays(durationDays),
            CreatedAt = now,
            UpdatedAt = now
        };

        var created = await _subscriptionRepository.CreateAsync(newSubscription);
        await _tenantRepository.AddCreditsAsync(tenantId, plan.CreditsIncluded);
        return created;
    }

    public async Task CancelSubscriptionAsync(Guid tenantId)
    {
        var existing = await _subscriptionRepository.GetActiveByTenantIdAsync(tenantId);
        if (existing != null)
        {
            existing.Status = "cancelled";
            existing.CancelledAt = DateTimeOffset.UtcNow;
            await _subscriptionRepository.UpdateAsync(existing);
            _logger.LogInformation("Subscription {SubId} for tenant {TenantId} marked as cancelled.", existing.Id, tenantId);
        }
    }
}
