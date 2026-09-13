using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Auth;
using EcommerceBot.Application.Interfaces;
using EcommerceBot.Domain.Entities;
using EcommerceBot.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace EcommerceBot.Infrastructure.Services;

public sealed class TenantSsoService : ITenantSsoService
{
    private readonly IRoleRepository _roleRepository;
    private readonly ITenantSsoMappingRepository _ssoMappingRepository;
    private readonly ILogger<TenantSsoService> _logger;

    public TenantSsoService(
        IRoleRepository roleRepository,
        ITenantSsoMappingRepository ssoMappingRepository,
        ILogger<TenantSsoService> logger)
    {
        _roleRepository = roleRepository;
        _ssoMappingRepository = ssoMappingRepository;
        _logger = logger;
    }

    public async Task<IEnumerable<RoleDto>> GetRolesAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var roles = await _roleRepository.GetAllAsync(cancellationToken);
            return roles.Select(r => new RoleDto
            {
                Id = r.Id,
                Name = r.Name,
                Description = r.Description,
                IsSystemRole = r.IsSystemRole
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter lista de papéis (Roles) do sistema");
            throw;
        }
    }

    public async Task<IEnumerable<TenantSsoMappingDto>> GetMappingsByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            var mappings = await _ssoMappingRepository.GetByTenantIdAsync(tenantId, cancellationToken);
            return mappings.Select(m => new TenantSsoMappingDto
            {
                Id = m.Id,
                TenantId = m.TenantId,
                IdpGroupName = m.IdpGroupName,
                RoleId = m.RoleId,
                RoleName = m.RoleName ?? string.Empty,
                IsDefaultRole = m.IsDefaultRole,
                CreatedAt = m.CreatedAt,
                UpdatedAt = m.UpdatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter mapeamentos de SSO para o Tenant {TenantId}", tenantId);
            throw;
        }
    }

    public async Task<TenantSsoMappingDto> CreateMappingAsync(Guid tenantId, CreateTenantSsoMappingRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            var role = await _roleRepository.GetByIdAsync(request.RoleId, cancellationToken) ?? throw new ArgumentException("O papel (Role) especificado não existe.");
            var existing = await _ssoMappingRepository.GetByGroupAsync(tenantId, request.IdpGroupName, cancellationToken);
            if (existing != null)
            {
                throw new InvalidOperationException($"Já existe um mapeamento para o grupo '{request.IdpGroupName}' neste Tenant.");
            }

            var mapping = new TenantSsoMapping
            {
                TenantId = tenantId,
                IdpGroupName = request.IdpGroupName.Trim(),
                RoleId = request.RoleId,
                IsDefaultRole = request.IsDefaultRole
            };

            var created = await _ssoMappingRepository.CreateAsync(mapping, cancellationToken);

            return new TenantSsoMappingDto
            {
                Id = created.Id,
                TenantId = created.TenantId,
                IdpGroupName = created.IdpGroupName,
                RoleId = created.RoleId,
                RoleName = role.Name,
                IsDefaultRole = created.IsDefaultRole,
                CreatedAt = created.CreatedAt,
                UpdatedAt = created.UpdatedAt
            };
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (InvalidOperationException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar mapeamento de SSO para o grupo '{GroupName}' no Tenant {TenantId}", request.IdpGroupName, tenantId);
            throw;
        }
    }

    public async Task<bool> UpdateMappingAsync(Guid id, Guid tenantId, UpdateTenantSsoMappingRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            var mapping = await _ssoMappingRepository.GetByIdAsync(id, tenantId, cancellationToken);
            if (mapping == null)
            {
                return false;
            }

            var role = await _roleRepository.GetByIdAsync(request.RoleId, cancellationToken);
            if (role == null)
            {
                throw new ArgumentException("O papel (Role) especificado não existe.");
            }

            mapping.IdpGroupName = request.IdpGroupName.Trim();
            mapping.RoleId = request.RoleId;
            mapping.IsDefaultRole = request.IsDefaultRole;

            return await _ssoMappingRepository.UpdateAsync(mapping, cancellationToken);
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao atualizar mapeamento de SSO {MappingId} para o Tenant {TenantId}", id, tenantId);
            throw;
        }
    }

    public async Task<bool> DeleteMappingAsync(Guid id, Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            return await _ssoMappingRepository.DeleteAsync(id, tenantId, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao excluir mapeamento de SSO {MappingId} para o Tenant {TenantId}", id, tenantId);
            throw;
        }
    }

    public async Task<(Guid RoleId, string RoleName)> ResolveRoleForGroupsAsync(Guid tenantId, IEnumerable<string> idpGroups, CancellationToken cancellationToken = default)
    {
        try
        {
            var mappings = (await _ssoMappingRepository.GetByTenantIdAsync(tenantId, cancellationToken)).ToList();
            var allRoles = (await _roleRepository.GetAllAsync(cancellationToken)).ToDictionary(r => r.Id, r => r.Name);

            // Hierarquia de prioridade se o usuário pertencer a múltiplos grupos
            var priorityOrder = new List<string> { "TENANT_ADMIN", "CATALOG_OPERATOR", "MEMBER", "VIEWER" };

            if (idpGroups != null && idpGroups.Any())
            {
                var matchedRoles = new List<(Guid RoleId, string RoleName)>();

                foreach (var group in idpGroups)
                {
                    var match = mappings.FirstOrDefault(m => string.Equals(m.IdpGroupName, group.Trim(), StringComparison.OrdinalIgnoreCase));
                    if (match != null && allRoles.TryGetValue(match.RoleId, out var roleName))
                    {
                        matchedRoles.Add((match.RoleId, roleName));
                    }
                }

                if (matchedRoles.Any())
                {
                    foreach (var priorityRole in priorityOrder)
                    {
                        var selected = matchedRoles.FirstOrDefault(r => string.Equals(r.RoleName, priorityRole, StringComparison.OrdinalIgnoreCase));
                        if (selected.RoleId != Guid.Empty)
                        {
                            return selected;
                        }
                    }
                    return matchedRoles.First();
                }
            }

            // Fallback 1: Default Role configurada no Tenant
            var defaultMapping = mappings.FirstOrDefault(m => m.IsDefaultRole);
            if (defaultMapping != null && allRoles.TryGetValue(defaultMapping.RoleId, out var defaultRoleName))
            {
                return (defaultMapping.RoleId, defaultRoleName);
            }

            // Fallback 2: Papel padrão canônico MEMBER
            var memberRole = await _roleRepository.GetByNameAsync("MEMBER", cancellationToken);
            if (memberRole != null)
            {
                return (memberRole.Id, memberRole.Name);
            }

            return (Guid.Parse("44444444-4444-4444-4444-444444444444"), "MEMBER");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao resolver papel de SSO para grupos do Tenant {TenantId}. Aplicando fallback MEMBER.", tenantId);
            return (Guid.Parse("44444444-4444-4444-4444-444444444444"), "MEMBER");
        }
    }
}
