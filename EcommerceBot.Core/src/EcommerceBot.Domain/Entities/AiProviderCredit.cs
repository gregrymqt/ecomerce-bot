using System;

namespace EcommerceBot.Domain.Entities;

/// <summary>
/// Registro de recarga e capacidade de saldo pré-pago de provedores de IA (OpenRouter, OpenAI, Anthropic).
/// </summary>
public sealed class AiProviderCredit
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

/// <summary>
/// Resumo diário agregado de consumo de tokens e custos para FinOps.
/// </summary>
public sealed class DailyTokenUsageSummary
{
    public string Date { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public long Tokens { get; set; }
    public decimal CostUsd { get; set; }
}
