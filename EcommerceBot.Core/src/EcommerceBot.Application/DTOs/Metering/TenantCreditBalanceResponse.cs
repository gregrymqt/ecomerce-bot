using System;

namespace EcommerceBot.Application.DTOs.Metering;

public sealed record TenantCreditBalanceResponse
{
    public string TenantId { get; init; } = string.Empty;
    public decimal ManagedCreditBalance { get; init; }
    public int MonthlyTotalTokens { get; init; }
    public decimal MonthlyTotalCostUsd { get; init; }
    public bool IsByokEnabled { get; init; }
    public string ActiveMode { get; init; } = "managed";
}
