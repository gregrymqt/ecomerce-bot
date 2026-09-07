namespace EcommerceBot.Application.DTOs.Auth;

public sealed record EnterpriseLeadRequest
{
    public string Email { get; init; } = string.Empty;
    public string? CompanyName { get; init; }
    public string? JobTitle { get; init; }
    public string? ExpectedVolume { get; init; }
    public string? Phone { get; init; }
    public string? TeamSize { get; init; }
    public string? Notes { get; init; }
}
