using System;
using System.Collections.Generic;

namespace EcommerceBot.Application.DTOs.Auth
{
    public class UserResponse
    {
        public Guid Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string? Name { get; set; }
        public string Role { get; set; } = string.Empty;
        public List<string> Tenants { get; set; } = new();
        public DateTimeOffset CreatedAt { get; set; }
        public string? AccessToken { get; set; }
    }
}
