using System;

namespace EcommerceBot.Domain.Exceptions;

/// <summary>
/// Exceção de domínio disparada quando um tenant tenta executar uma operação que requer créditos de IA/scraping,
/// mas seu saldo disponível na carteira é insuficiente.
/// </summary>
public sealed class InsufficientCreditsException : Exception
{
    public Guid TenantId { get; }
    public int RequiredCredits { get; }
    public int CurrentBalance { get; }

    public InsufficientCreditsException(string message) : base(message)
    {
    }

    public InsufficientCreditsException(Guid tenantId, int requiredCredits, int currentBalance)
        : base($"Saldo de créditos insuficiente para o Tenant {tenantId}. Requerido: {requiredCredits}, Saldo Atual: {currentBalance}.")
    {
        TenantId = tenantId;
        RequiredCredits = requiredCredits;
        CurrentBalance = currentBalance;
    }
}
