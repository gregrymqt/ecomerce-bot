using System;

namespace EcommerceBot.Application.DTOs.Auth;

public sealed record EnterpriseLeadResponse
{
    public Guid Id { get; init; }
    public string Email { get; init; } = string.Empty;
    public string? CompanyName { get; init; }
    public string Message { get; init; } = string.Empty;
}
