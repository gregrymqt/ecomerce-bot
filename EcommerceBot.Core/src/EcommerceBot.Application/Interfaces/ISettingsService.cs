using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Settings;

namespace EcommerceBot.Application.Interfaces;

public interface ISettingsService
{
    Task<TenantSettingsResponse> GetSettingsAsync(Guid tenantId);
    Task<TenantSettingsResponse> UpdateSettingsAsync(Guid tenantId, TenantSettingsUpdate data);
}
