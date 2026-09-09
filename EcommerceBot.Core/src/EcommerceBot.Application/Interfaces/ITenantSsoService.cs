using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Auth;

namespace EcommerceBot.Application.Interfaces;

public interface ITenantSsoService
{
    Task<IEnumerable<RoleDto>> GetRolesAsync(CancellationToken cancellationToken = default);
    Task<IEnumerable<TenantSsoMappingDto>> GetMappingsByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<TenantSsoMappingDto> CreateMappingAsync(Guid tenantId, CreateTenantSsoMappingRequest request, CancellationToken cancellationToken = default);
    Task<bool> UpdateMappingAsync(Guid id, Guid tenantId, UpdateTenantSsoMappingRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteMappingAsync(Guid id, Guid tenantId, CancellationToken cancellationToken = default);
    Task<(Guid RoleId, string RoleName)> ResolveRoleForGroupsAsync(Guid tenantId, IEnumerable<string> idpGroups, CancellationToken cancellationToken = default);
}
