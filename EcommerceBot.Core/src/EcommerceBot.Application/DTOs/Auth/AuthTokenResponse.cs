using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.Auth
{
    public class AuthTokenResponse
    {
        public string AccessToken { get; set; } = string.Empty;
        public string TokenType { get; set; } = "bearer";
        public string UserId { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Name { get; set; }
        public List<string> Tenants { get; set; } = new();
        public string TenantId { get; set; } = string.Empty;
    }
}
