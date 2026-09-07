using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Plans;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public sealed class PlanService : IPlanService
{
    private readonly IPlanRepository _planRepository;
    private readonly ILogger<PlanService> _logger;

    public PlanService(
        IPlanRepository planRepository, 
        ILogger<PlanService> logger)
    {
        _planRepository = planRepository;
        _logger = logger;
    }

    private static PlanResponse MapToResponse(Plan plan)
    {
        return new PlanResponse
        {
            Id = plan.Id,
            Name = plan.Name,
            Description = plan.Description,
            Price = plan.Price,
            CreditsIncluded = plan.CreditsIncluded,
            BillingInterval = plan.BillingInterval,
            MpPreapprovalPlanId = plan.MpPreapprovalPlanId,
            TrialDays = plan.TrialDays,
            Badge = plan.Badge,
            IsActive = plan.IsActive,
            CreatedAt = plan.CreatedAt,
            UpdatedAt = plan.UpdatedAt
        };
    }

    public async Task<PlanResponse?> GetPlanByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var plan = await _planRepository.GetByIdAsync(id, cancellationToken);
        return plan != null ? MapToResponse(plan) : null;
    }

    public async Task<IEnumerable<PlanResponse>> GetAllPlansAsync(bool onlyActive = false, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Buscando catálogo de planos (onlyActive: {OnlyActive})", onlyActive);
        var plans = await _planRepository.GetAllAsync(onlyActive, cancellationToken);
        return plans.Select(MapToResponse).ToList();
    }

    public async Task<PlanResponse> CreatePlanAsync(CreatePlanRequest request, CancellationToken cancellationToken = default)
    {
        var plan = new Plan
        {
            Name = request.Name,
            Description = request.Description,
            Price = request.Price,
            CreditsIncluded = request.CreditsIncluded,
            BillingInterval = request.BillingInterval,
            MpPreapprovalPlanId = request.MpPreapprovalPlanId,
            TrialDays = request.TrialDays,
            Badge = request.Badge,
            IsActive = request.IsActive
        };

        plan.Id = await _planRepository.CreateAsync(plan, cancellationToken);

        var created = await _planRepository.GetByIdAsync(plan.Id, cancellationToken);
        return MapToResponse(created ?? plan);
    }

    public async Task<PlanResponse?> UpdatePlanAsync(Guid id, UpdatePlanRequest request, CancellationToken cancellationToken = default)
    {
        var plan = await _planRepository.GetByIdAsync(id, cancellationToken);
        if (plan == null) return null;

        if (request.Name != null) plan.Name = request.Name;
        if (request.Description != null) plan.Description = request.Description;
        if (request.Price.HasValue) plan.Price = request.Price.Value;
        if (request.CreditsIncluded.HasValue) plan.CreditsIncluded = request.CreditsIncluded.Value;
        if (request.BillingInterval != null) plan.BillingInterval = request.BillingInterval;
        if (request.MpPreapprovalPlanId != null) plan.MpPreapprovalPlanId = request.MpPreapprovalPlanId;
        if (request.TrialDays.HasValue) plan.TrialDays = request.TrialDays.Value;
        if (request.Badge != null) plan.Badge = request.Badge;
        if (request.IsActive.HasValue) plan.IsActive = request.IsActive.Value;

        await _planRepository.UpdateAsync(plan, cancellationToken);

        var updated = await _planRepository.GetByIdAsync(id, cancellationToken);
        return updated != null ? MapToResponse(updated) : null;
    }
}
