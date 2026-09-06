using System;

namespace EcommerceBot.Domain.Exceptions;

/// <summary>
/// Exceção lançada quando um tenant tenta realizar uma operação que requer créditos
/// mas seu saldo de créditos na carteira é insuficiente.
/// </summary>
public class InsufficientCreditsException : Exception
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
