using System;
using System.Text.Json;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Settings;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public sealed class SettingsService : ISettingsService
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

    private T DeserializeOrDefault<T>(string? json, T defaultObj)
    {
        if (string.IsNullOrWhiteSpace(json)) return defaultObj;
        try
        {
            return JsonSerializer.Deserialize<T>(json) ?? defaultObj;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao desserializar JSON de configurações para o tipo {Type}. Retornando valor padrão.", typeof(T).Name);
            return defaultObj;
        }
    }

    public async Task<TenantSettingsResponse> GetSettingsAsync(Guid tenantId)
    {
        var cacheKey = $"settings:{tenantId}";
        try
        {
            var cached = await _redisService.GetAsync<TenantSettingsResponse>(cacheKey);
            if (cached != null)
            {
                _logger.LogInformation("Cache hit for settings of tenant '{TenantId}'", tenantId);
                return cached;
            }
        }
        catch (Exception redisEx)
        {
            _logger.LogWarning(redisEx, "Aviso: Falha ao ler cache de configurações do Redis para Tenant {TenantId}. Consultando banco de dados...", tenantId);
        }

        try
        {
            var config = await _repository.GetByTenantIdAsync(tenantId);

            var response = new TenantSettingsResponse
            {
                TenantId = tenantId.ToString(),
                AiSettings = DeserializeOrDefault(config?.AiSettingsJson, new AiSettingsDto()),
                PricingSettings = DeserializeOrDefault(config?.PricingSettingsJson, new PricingSettingsDto()),
                StoreProfile = DeserializeOrDefault(config?.StoreProfileJson, new StoreProfileDto()),
                UpdatedAt = config?.UpdatedAt
            };

            try
            {
                await _redisService.SetAsync(cacheKey, response, TimeSpan.FromHours(1));
            }
            catch (Exception redisSetEx)
            {
                _logger.LogWarning(redisSetEx, "Aviso: Falha ao gravar cache de configurações no Redis para Tenant {TenantId}.", tenantId);
            }

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter configurações do Tenant {TenantId} do repositório.", tenantId);
            throw;
        }
    }

    public async Task<TenantSettingsResponse> UpdateSettingsAsync(Guid tenantId, TenantSettingsUpdate data)
    {
        try
        {
            var config = await _repository.GetByTenantIdAsync(tenantId) ?? new TenantConfig { TenantId = tenantId };

        var currentAi = DeserializeOrDefault(config.AiSettingsJson, new AiSettingsDto());
        var currentPricing = DeserializeOrDefault(config.PricingSettingsJson, new PricingSettingsDto());
        var currentProfile = DeserializeOrDefault(config.StoreProfileJson, new StoreProfileDto());

        if (data.AiSettings != null)
        {
            currentAi = currentAi with
            {
                ToneOfVoice = !string.IsNullOrEmpty(data.AiSettings.ToneOfVoice) ? data.AiSettings.ToneOfVoice : currentAi.ToneOfVoice,
                TargetLanguage = !string.IsNullOrEmpty(data.AiSettings.TargetLanguage) ? data.AiSettings.TargetLanguage : currentAi.TargetLanguage,
                SeoTagsEnabled = data.AiSettings.SeoTagsEnabled,
                CustomInstructions = data.AiSettings.CustomInstructions ?? currentAi.CustomInstructions
            };
        }

        if (data.PricingSettings != null)
        {
            currentPricing = currentPricing with
            {
                MarginPercentage = data.PricingSettings.MarginPercentage,
                RoundCents = data.PricingSettings.RoundCents
            };
        }

        if (data.StoreProfile != null)
        {
            currentProfile = currentProfile with
            {
                StoreName = data.StoreProfile.StoreName ?? currentProfile.StoreName,
                Niche = data.StoreProfile.Niche ?? currentProfile.Niche,
                SupportEmail = data.StoreProfile.SupportEmail ?? currentProfile.SupportEmail
            };
        }

            config.AiSettingsJson = JsonSerializer.Serialize(currentAi);
            config.PricingSettingsJson = JsonSerializer.Serialize(currentPricing);
            config.StoreProfileJson = JsonSerializer.Serialize(currentProfile);

            await _repository.UpsertAsync(config);

            var cacheKey = $"settings:{tenantId}";
            try
            {
                await _redisService.RemoveAsync(cacheKey);
                _logger.LogInformation("Redis cache for settings of tenant '{TenantId}' successfully invalidated.", tenantId);
            }
            catch (Exception redisEx)
            {
                _logger.LogWarning(redisEx, "Aviso: Falha ao invalidar cache no Redis para Tenant {TenantId}.", tenantId);
            }

            return await GetSettingsAsync(tenantId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao atualizar configurações do Tenant {TenantId}", tenantId);
            throw;
        }
    }
}
