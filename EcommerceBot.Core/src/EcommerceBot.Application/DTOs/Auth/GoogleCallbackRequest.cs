namespace EcommerceBot.Application.DTOs.Auth;

public sealed record GoogleCallbackRequest
{
    public string Code { get; init; } = string.Empty;
    public string? TenantName { get; init; }
}
