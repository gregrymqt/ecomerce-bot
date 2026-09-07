using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace EcommerceBot.Application.DTOs.Auth;

public sealed record AuthenticatedUser
{
    [JsonPropertyName("userId")]
    public string UserId { get; init; } = string.Empty;

    [JsonPropertyName("email")]
    public string Email { get; init; } = string.Empty;

    [JsonPropertyName("name")]
    public string? Name { get; init; }

    [JsonPropertyName("role")]
    public string Role { get; init; } = string.Empty;

    [JsonPropertyName("isAdmin")]
    public bool IsAdmin { get; init; }

    [JsonPropertyName("tenants")]
    public List<string> Tenants { get; init; } = new();

    [JsonPropertyName("plan")]
    public string? Plan { get; init; }

    [JsonPropertyName("creditsBalance")]
    public int CreditsBalance { get; init; }

    [JsonPropertyName("hasActiveCredits")]
    public bool HasActiveCredits { get; init; }
}
