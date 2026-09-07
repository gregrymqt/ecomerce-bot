using System;

namespace EcommerceBot.Domain.Entities;

/// <summary>
/// Entidade imutável do Ledger de Créditos (dbo.CreditTransactions).
/// Registra cada entrada (recargas, bônus, estornos) ou saída (enriquecimento, ML) de créditos de IA.
/// </summary>
public sealed class CreditTransaction
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid? OrderId { get; set; }
    public int Amount { get; set; }
    public int BalanceAfter { get; set; }
    public string Type { get; set; } = string.Empty; // 'WELCOME_BONUS', 'RECHARGE', 'PRODUCT_ENRICHMENT', 'ML_ANALYSIS', 'REFUND'
    public string Description { get; set; } = string.Empty;
    public string? ReferenceId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
