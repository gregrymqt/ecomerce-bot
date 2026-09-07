namespace EcommerceBot.Application.DTOs.Auth;

public sealed record LoginRequest
{
    public string Email { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
    public string? TenantId { get; init; }
}
