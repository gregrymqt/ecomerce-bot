using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Tenant;

namespace EcommerceBot.Application.Interfaces;

public interface ITenantService
{
    Task<TenantProfileDto?> GetTenantProfileAsync(Guid tenantId);
}
