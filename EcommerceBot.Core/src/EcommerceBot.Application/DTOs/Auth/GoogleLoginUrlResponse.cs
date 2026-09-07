namespace EcommerceBot.Application.DTOs.Auth;

public sealed record GoogleLoginUrlResponse
{
    public string Url { get; init; } = string.Empty;
}
