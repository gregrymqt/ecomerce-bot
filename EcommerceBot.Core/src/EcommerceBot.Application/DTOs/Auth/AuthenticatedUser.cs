using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.Auth
{
    public class AuthenticatedUser
    {
        public string UserId { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Name { get; set; }
        public string Role { get; set; } = string.Empty;
        public bool IsAdmin { get; set; }
        public List<string> Tenants { get; set; } = new();
        public string? Plan { get; set; }
    }
}
