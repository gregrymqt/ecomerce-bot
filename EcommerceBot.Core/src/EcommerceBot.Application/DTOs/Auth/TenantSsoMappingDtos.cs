using System;
using System.ComponentModel.DataAnnotations;

namespace EcommerceBot.Application.DTOs.Auth
{
    public class RoleDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public bool IsSystemRole { get; set; }
    }

    public class TenantSsoMappingDto
    {
        public Guid Id { get; set; }
        public Guid TenantId { get; set; }
        public string IdpGroupName { get; set; } = string.Empty;
        public Guid RoleId { get; set; }
        public string RoleName { get; set; } = string.Empty;
        public bool IsDefaultRole { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }

    public class CreateTenantSsoMappingRequest
    {
        [Required(ErrorMessage = "O nome do grupo do Provedor de Identidade (IdP) é obrigatório.")]
        [MaxLength(150, ErrorMessage = "O nome do grupo não pode exceder 150 caracteres.")]
        public string IdpGroupName { get; set; } = string.Empty;

        [Required(ErrorMessage = "O RoleId de destino é obrigatório.")]
        public Guid RoleId { get; set; }

        public bool IsDefaultRole { get; set; } = false;
    }

    public class UpdateTenantSsoMappingRequest
    {
        [Required(ErrorMessage = "O nome do grupo do Provedor de Identidade (IdP) é obrigatório.")]
        [MaxLength(150, ErrorMessage = "O nome do grupo não pode exceder 150 caracteres.")]
        public string IdpGroupName { get; set; } = string.Empty;

        [Required(ErrorMessage = "O RoleId de destino é obrigatório.")]
        public Guid RoleId { get; set; }

        public bool IsDefaultRole { get; set; } = false;
    }
}
