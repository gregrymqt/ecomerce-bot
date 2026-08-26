using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Tenant;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public class TenantService : ITenantService
{
    private readonly ITenantRepository _tenantRepository;
    private readonly ILogger<TenantService> _logger;

    public TenantService(ITenantRepository tenantRepository, ILogger<TenantService> logger)
    {
        _tenantRepository = tenantRepository;
        _logger = logger;
    }

    public async Task<TenantProfileDto?> GetTenantProfileAsync(Guid tenantId)
    {
        var tenant = await _tenantRepository.GetByIdAsync(tenantId);
        if (tenant == null)
        {
            _logger.LogWarning("Tenant '{TenantId}' not found.", tenantId);
            return null;
        }

        return new TenantProfileDto
        {
            Id = tenant.Id,
            Name = tenant.Name,
            Slug = tenant.Slug,
            PlanTier = tenant.PlanTier,
            CreditsBalance = tenant.CreditsBalance,
            IsActive = tenant.IsActive,
            CreatedAt = tenant.CreatedAt,
            UpdatedAt = tenant.UpdatedAt
        };
    }
}
