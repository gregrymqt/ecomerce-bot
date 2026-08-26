using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Plans;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public class PlanService : IPlanService
{
    private readonly IPlanRepository _planRepository;
    private readonly IDistributedCache _cache;
    private readonly ILogger<PlanService> _logger;
    private const string PlansCacheKey = "Plans:All";

    public PlanService(
        IPlanRepository planRepository, 
        IDistributedCache cache, 
        ILogger<PlanService> logger)
    {
        _planRepository = planRepository;
        _cache = cache;
        _logger = logger;
    }

    private PlanResponse MapToResponse(Plan plan)
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
            IsActive = plan.IsActive,
            CreatedAt = plan.CreatedAt,
            UpdatedAt = plan.UpdatedAt
        };
    }

    public async Task<PlanResponse?> GetPlanByIdAsync(Guid id)
    {
        var plan = await _planRepository.GetByIdAsync(id);
        return plan != null ? MapToResponse(plan) : null;
    }

    public async Task<IEnumerable<PlanResponse>> GetAllPlansAsync(bool onlyActive = false)
    {
        var cacheKey = onlyActive ? $"{PlansCacheKey}:Active" : $"{PlansCacheKey}:All";
        var cached = await _cache.GetStringAsync(cacheKey);

        if (!string.IsNullOrEmpty(cached))
        {
            _logger.LogInformation("Returning plans from cache {Key}", cacheKey);
            var result = JsonSerializer.Deserialize<List<PlanResponse>>(cached);
            if (result != null) return result;
        }

        _logger.LogInformation("Fetching plans from database");
        var plans = await _planRepository.GetAllAsync(onlyActive);
        var responses = plans.Select(MapToResponse).ToList();

        var cacheOptions = new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30)
        };
        await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(responses), cacheOptions);

        return responses;
    }

    public async Task<PlanResponse> CreatePlanAsync(CreatePlanRequest request)
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
            IsActive = request.IsActive
        };

        plan.Id = await _planRepository.CreateAsync(plan);

        await InvalidateCacheAsync();
        
        // Fetch to get exact CreatedAt
        var created = await _planRepository.GetByIdAsync(plan.Id);
        return MapToResponse(created ?? plan);
    }

    public async Task<PlanResponse?> UpdatePlanAsync(Guid id, UpdatePlanRequest request)
    {
        var plan = await _planRepository.GetByIdAsync(id);
        if (plan == null) return null;

        if (request.Name != null) plan.Name = request.Name;
        if (request.Description != null) plan.Description = request.Description;
        if (request.Price.HasValue) plan.Price = request.Price.Value;
        if (request.CreditsIncluded.HasValue) plan.CreditsIncluded = request.CreditsIncluded.Value;
        if (request.BillingInterval != null) plan.BillingInterval = request.BillingInterval;
        if (request.MpPreapprovalPlanId != null) plan.MpPreapprovalPlanId = request.MpPreapprovalPlanId;
        if (request.TrialDays.HasValue) plan.TrialDays = request.TrialDays.Value;
        if (request.IsActive.HasValue) plan.IsActive = request.IsActive.Value;

        await _planRepository.UpdateAsync(plan);

        await InvalidateCacheAsync();

        var updated = await _planRepository.GetByIdAsync(id);
        return updated != null ? MapToResponse(updated) : null;
    }

    private async Task InvalidateCacheAsync()
    {
        _logger.LogInformation("Invalidating plans cache");
        await _cache.RemoveAsync($"{PlansCacheKey}:All");
        await _cache.RemoveAsync($"{PlansCacheKey}:Active");
    }
}
