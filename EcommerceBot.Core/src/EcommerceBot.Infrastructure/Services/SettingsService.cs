using System;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Settings;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public class SettingsService : ISettingsService
{
    private readonly ITenantConfigRepository _repository;
    private readonly IRedisService _redisService;
    private readonly ILogger<SettingsService> _logger;

    public SettingsService(
        ITenantConfigRepository repository,
        IRedisService redisService,
        ILogger<SettingsService> logger)
    {
        _repository = repository;
        _redisService = redisService;
        _logger = logger;
    }

    private static T DeserializeOrDefault<T>(string? json, T defaultObj)
    {
        if (string.IsNullOrWhiteSpace(json)) return defaultObj;
        try
        {
            return JsonSerializer.Deserialize<T>(json) ?? defaultObj;
        }
        catch
        {
            return defaultObj;
        }
    }

    public async Task<TenantSettingsResponse> GetSettingsAsync(Guid tenantId)
    {
        var cacheKey = $"settings:{tenantId}";
        var cached = await _redisService.GetAsync<TenantSettingsResponse>(cacheKey);
        if (cached != null)
        {
            _logger.LogInformation("Cache hit for settings of tenant '{TenantId}'", tenantId);
            return cached;
        }

        var config = await _repository.GetByTenantIdAsync(tenantId);

        var response = new TenantSettingsResponse
        {
            TenantId = tenantId.ToString(),
            AiSettings = DeserializeOrDefault(config?.AiSettingsJson, new AiSettingsDto()),
            PricingSettings = DeserializeOrDefault(config?.PricingSettingsJson, new PricingSettingsDto()),
            StoreProfile = DeserializeOrDefault(config?.StoreProfileJson, new StoreProfileDto()),
            UpdatedAt = config?.UpdatedAt
        };

        await _redisService.SetAsync(cacheKey, response, TimeSpan.FromHours(1));

        return response;
    }

    public async Task<TenantSettingsResponse> UpdateSettingsAsync(Guid tenantId, TenantSettingsUpdate data)
    {
        var config = await _repository.GetByTenantIdAsync(tenantId) ?? new TenantConfig { TenantId = tenantId };

        var currentAi = DeserializeOrDefault(config.AiSettingsJson, new AiSettingsDto());
        var currentPricing = DeserializeOrDefault(config.PricingSettingsJson, new PricingSettingsDto());
        var currentProfile = DeserializeOrDefault(config.StoreProfileJson, new StoreProfileDto());

        if (data.AiSettings != null)
        {
            if (!string.IsNullOrEmpty(data.AiSettings.ToneOfVoice)) currentAi.ToneOfVoice = data.AiSettings.ToneOfVoice;
            if (!string.IsNullOrEmpty(data.AiSettings.TargetLanguage)) currentAi.TargetLanguage = data.AiSettings.TargetLanguage;
            currentAi.SeoTagsEnabled = data.AiSettings.SeoTagsEnabled;
            if (data.AiSettings.CustomInstructions != null) currentAi.CustomInstructions = data.AiSettings.CustomInstructions;
        }

        if (data.PricingSettings != null)
        {
            currentPricing.MarginPercentage = data.PricingSettings.MarginPercentage;
            currentPricing.RoundCents = data.PricingSettings.RoundCents;
        }

        if (data.StoreProfile != null)
        {
            if (data.StoreProfile.StoreName != null) currentProfile.StoreName = data.StoreProfile.StoreName;
            if (data.StoreProfile.Niche != null) currentProfile.Niche = data.StoreProfile.Niche;
            if (data.StoreProfile.SupportEmail != null) currentProfile.SupportEmail = data.StoreProfile.SupportEmail;
        }

        config.AiSettingsJson = JsonSerializer.Serialize(currentAi);
        config.PricingSettingsJson = JsonSerializer.Serialize(currentPricing);
        config.StoreProfileJson = JsonSerializer.Serialize(currentProfile);

        await _repository.UpsertAsync(config);

        var cacheKey = $"settings:{tenantId}";
        await _redisService.RemoveAsync(cacheKey);
        _logger.LogInformation("Redis cache for settings of tenant '{TenantId}' successfully invalidated.", tenantId);

        return await GetSettingsAsync(tenantId);
    }
}
