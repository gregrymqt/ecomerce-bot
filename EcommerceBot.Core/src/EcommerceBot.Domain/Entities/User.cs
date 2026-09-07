using System;

namespace EcommerceBot.Domain.Entities;

/// <summary>
/// Usuário do sistema associado a um Tenant e a um papel de autorização RBAC (dbo.Users).
/// </summary>
public sealed class User
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid? RoleId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string Role { get; set; } = "MEMBER";
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
