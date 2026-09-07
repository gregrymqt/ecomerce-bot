namespace EcommerceBot.Application.DTOs.Auth;

public sealed record CreateUserRequest
{
    public string Email { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
    public string? Name { get; init; }
    public string? Role { get; init; }
    public string? TenantId { get; init; }
    public string? UtmSource { get; init; }
    public string? UtmMedium { get; init; }
    public string? UtmCampaign { get; init; }
    public string? AdId { get; init; }
}
