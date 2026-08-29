using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Auth;

namespace EcommerceBot.Application.Interfaces;

public interface ITenantSsoService
{
    Task<IEnumerable<RoleDto>> GetRolesAsync();
    Task<IEnumerable<TenantSsoMappingDto>> GetMappingsByTenantIdAsync(Guid tenantId);
    Task<TenantSsoMappingDto> CreateMappingAsync(Guid tenantId, CreateTenantSsoMappingRequest request);
    Task<bool> UpdateMappingAsync(Guid id, Guid tenantId, UpdateTenantSsoMappingRequest request);
    Task<bool> DeleteMappingAsync(Guid id, Guid tenantId);
    Task<(Guid RoleId, string RoleName)> ResolveRoleForGroupsAsync(Guid tenantId, IEnumerable<string> idpGroups);
}
