using System;

namespace EcommerceBot.Domain.Entities;

public class AiProviderCredit
{
    public Guid Id { get; set; }
    public string Provider { get; set; } = string.Empty;
    public decimal AmountPaid { get; set; }
    public string Currency { get; set; } = "USD";
    public long TokensCredited { get; set; }
    public decimal BalanceRemaining { get; set; }
    public string? TransactionReference { get; set; }
    public string Source { get; set; } = "MANUAL_ADMIN";
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class DailyTokenUsageSummary
{
    public string Date { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public long Tokens { get; set; }
    public decimal CostUsd { get; set; }
}
