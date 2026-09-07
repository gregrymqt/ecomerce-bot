using System;
using System.ComponentModel.DataAnnotations;

namespace EcommerceBot.Application.DTOs.Auth;

public sealed record RoleDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public bool IsSystemRole { get; init; }
}

public sealed record TenantSsoMappingDto
{
    public Guid Id { get; init; }
    public Guid TenantId { get; init; }
    public string IdpGroupName { get; init; } = string.Empty;
    public Guid RoleId { get; init; }
    public string RoleName { get; init; } = string.Empty;
    public bool IsDefaultRole { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}

public sealed record CreateTenantSsoMappingRequest
{
    [Required(ErrorMessage = "O nome do grupo do Provedor de Identidade (IdP) é obrigatório.")]
    [MaxLength(150, ErrorMessage = "O nome do grupo não pode exceder 150 caracteres.")]
    public string IdpGroupName { get; init; } = string.Empty;

    [Required(ErrorMessage = "O RoleId de destino é obrigatório.")]
    public Guid RoleId { get; init; }

    public bool IsDefaultRole { get; init; } = false;
}

public sealed record UpdateTenantSsoMappingRequest
{
    [Required(ErrorMessage = "O nome do grupo do Provedor de Identidade (IdP) é obrigatório.")]
    [MaxLength(150, ErrorMessage = "O nome do grupo não pode exceder 150 caracteres.")]
    public string IdpGroupName { get; init; } = string.Empty;

    [Required(ErrorMessage = "O RoleId de destino é obrigatório.")]
    public Guid RoleId { get; init; }

    public bool IsDefaultRole { get; init; } = false;
}
