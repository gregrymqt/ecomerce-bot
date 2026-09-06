using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Auth
{
    public class AuthenticatedUser
    {
        [JsonPropertyName("userId")]
        public string UserId { get; set; } = string.Empty;

        [JsonPropertyName("email")]
        public string Email { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("role")]
        public string Role { get; set; } = string.Empty;

        [JsonPropertyName("isAdmin")]
        public bool IsAdmin { get; set; }

        [JsonPropertyName("tenants")]
        public List<string> Tenants { get; set; } = new();

        [JsonPropertyName("plan")]
        public string? Plan { get; set; }

        [JsonPropertyName("creditsBalance")]
        public int CreditsBalance { get; set; }

        [JsonPropertyName("hasActiveCredits")]
        public bool HasActiveCredits { get; set; }
    }
}
