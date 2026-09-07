namespace EcommerceBot.Application.DTOs.Auth;

public sealed record UpdateUserRequest
{
    public string? Name { get; init; }
    public string? Password { get; init; }
    public string? Role { get; init; }
}
