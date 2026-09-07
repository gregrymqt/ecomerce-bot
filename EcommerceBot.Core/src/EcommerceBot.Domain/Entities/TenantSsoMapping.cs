using System;

namespace EcommerceBot.Domain.Entities;

/// <summary>
/// Mapeamento de grupos de Identity Providers corporativos (IdP SSO) para papéis RBAC no tenant (dbo.TenantSsoMappings).
/// </summary>
public sealed class TenantSsoMapping
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string IdpGroupName { get; set; } = string.Empty;
    public Guid RoleId { get; set; }
    public string? RoleName { get; set; }
    public bool IsDefaultRole { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
