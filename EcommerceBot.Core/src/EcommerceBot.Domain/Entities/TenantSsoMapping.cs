using System;

namespace EcommerceBot.Domain.Entities;

public class TenantSsoMapping
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string IdpGroupName { get; set; } = string.Empty;
    public Guid RoleId { get; set; }
    public string? RoleName { get; set; }
    public bool IsDefaultRole { get; set; } = false;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
