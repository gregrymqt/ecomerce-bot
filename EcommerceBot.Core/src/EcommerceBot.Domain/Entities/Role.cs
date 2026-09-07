using System;

namespace EcommerceBot.Domain.Entities;

/// <summary>
/// Papel de autorização do sistema para controle de acesso baseado em funções - RBAC (dbo.Roles).
/// </summary>
public sealed class Role
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsSystemRole { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
